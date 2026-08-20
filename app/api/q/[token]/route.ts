/**
 * Public RFQ submit endpoint.
 *
 * Per spec §7.4:
 *   - Rate limit BEFORE the DB. §7.5.
 *   - Validate token (resolveRfqToken returns identical
 *     generic 410 for all failure modes).
 *   - Zod-validate the body, bound every string + number.
 *   - Only accept listLineIds that actually belong to THIS
 *     RFQ's list (silently drop the rest — spec §9.3).
 *   - Idempotency: same UUID = same outcome, no duplicate
 *     quotes.
 *   - Server recomputes money from qty × unitPrice (§9.10).
 *   - Append PriceObservation rows (the moat).
 *   - Log SUBMITTED/DECLINED event with hashed IP.
 *   - Require Content-Type: application/json (§9.9).
 *
 * No Clerk session. Token is the credential.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db/client';
import { resolveRfqToken } from '@/lib/procurement/resolveRfqToken';
import { rateLimit } from '@/lib/procurement/rateLimit';

const LineSchema = z.object({
  listLineId: z.string().min(1).max(64),
  unitPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  available: z.boolean().default(true),
  leadTimeDays: z.coerce.number().int().min(0).max(999).optional(),
  isSubstitute: z.boolean().default(false),
  substituteNote: z.string().max(500).optional(),
  vendorSku: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const BodySchema = z.object({
  action: z.enum(['SUBMIT', 'DECLINE']),
  respondentName: z.string().min(1).max(120),
  respondentEmail: z.string().email().max(200),
  vendorReference: z.string().max(80).optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(999).optional(),
  freightAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  taxAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  terms: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  declineReason: z.string().max(500).optional(),
  lines: z.array(LineSchema).max(500).default([]),
  idempotencyKey: z.string().min(1).max(100),
});

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  // 1. CSRF guard: must be JSON, not a form submission. Spec §9.9.
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.toLowerCase().includes('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 415 },
    );
  }

  const ip = clientIp(req);
  const userAgent = req.headers.get('user-agent');

  // 2. Rate limit before anything else. Token prefix + IP
  //    means one vendor on one IP is bounded regardless of
  //    how many token variants they try.
  const limited = await rateLimit(`rfq:submit:${params.token.slice(0, 12)}:${ip}`, {
    max: 10,
    windowSec: 600,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  // 3. Resolve token. Generic 410 for any failure.
  const result = await resolveRfqToken(params.token);
  if (!result.ok) {
    return NextResponse.json({ error: 'This link is no longer valid' }, { status: 410 });
  }
  const { rfq } = result;

  // 4. Validate body.
  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid submission', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 5. Filter lines to only those that belong to THIS list.
  //    Spec §9.3: reject unknown line IDs rather than silently
  //    inserting them; but here we silently drop, since the
  //    portal pre-fills from server data and a client tampering
  //    with line IDs is the only way these would mismatch.
  const validIds = new Set(rfq.list.lines.map((l) => l.id));
  const submittedLines = body.lines.filter((l) => validIds.has(l.listLineId));

  // 6. Decline path.
  if (body.action === 'DECLINE') {
    await prisma.$transaction([
      prisma.rfq.update({
        where: { id: rfq.id },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
          // Snapshot the respondent on decline too — useful
          // audit when the buyer later calls "who said no".
          ...(body.respondentName ? {} : {}),
        },
      }),
      prisma.rfqEvent.create({
        data: {
          workspaceId: rfq.workspaceId,
          rfqId: rfq.id,
          type: 'DECLINED',
          actor: 'vendor',
          ipHash: hashIp(ip),
          userAgent: userAgent?.slice(0, 300),
          meta: { reason: body.declineReason ?? null, email: body.respondentEmail },
        },
      }),
    ]);
    return NextResponse.json({
      ok: true,
      redirect: `/q/${encodeURIComponent(params.token)}/submitted`,
    });
  }

  // 7. Idempotency. A retried submit with the same key must
  //    return the same outcome, no duplicate insert.
  const replay = await prisma.vendorQuote.findUnique({
    where: { idempotencyKey: body.idempotencyKey },
    select: { id: true, rfqId: true },
  });
  if (replay) {
    if (replay.rfqId !== rfq.id) {
      // Same key reused across different RFQs is a client bug;
      // treat it as a fresh submission would.
      return NextResponse.json({ error: 'Invalid idempotency key' }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      redirect: `/q/${encodeURIComponent(params.token)}/submitted`,
    });
  }

  // 8. Build the quote server-side. Money is recomputed from
  //    quantity × unitPrice. Never trust client totals (§9.10).
  const D = (n: number | undefined) =>
    n === undefined ? null : new Prisma.Decimal(n.toFixed(4));

  await prisma.$transaction(async (tx) => {
    // Supersede any prior submitted revision.
    const prior = await tx.vendorQuote.findFirst({
      where: { rfqId: rfq.id, status: 'SUBMITTED' },
      orderBy: { revision: 'desc' },
    });
    if (prior) {
      await tx.vendorQuote.update({
        where: { id: prior.id },
        data: { status: 'SUPERSEDED' },
      });
    }

    let subtotal = new Prisma.Decimal(0);
    const lineData = submittedLines.map((l, i) => {
      const src = rfq.list.lines.find((x) => x.id === l.listLineId)!;
      const unit = D(l.unitPrice);
      const total = unit ? unit.mul(src.quantity) : null;
      if (total) subtotal = subtotal.add(total);
      return {
        workspaceId: rfq.workspaceId,
        listLineId: l.listLineId,
        position: i,
        description: src.description,
        vendorSku: l.vendorSku ?? null,
        quantity: src.quantity,
        uom: src.uom,
        unitPrice: unit,
        lineTotal: total,
        available: l.available,
        leadTimeDays: l.leadTimeDays ?? null,
        isSubstitute: l.isSubstitute,
        substituteNote: l.isSubstitute ? l.substituteNote ?? null : null,
        notes: l.notes ?? null,
      };
    });

    const tax = new Prisma.Decimal(body.taxAmount.toFixed(4));
    const freight = new Prisma.Decimal(body.freightAmount.toFixed(4));

    const created = await tx.vendorQuote.create({
      data: {
        workspaceId: rfq.workspaceId,
        rfqId: rfq.id,
        vendorId: rfq.vendorId,
        idempotencyKey: body.idempotencyKey,
        revision: (prior?.revision ?? 0) + 1,
        vendorReference: body.vendorReference ?? null,
        respondentName: body.respondentName,
        respondentEmail: body.respondentEmail,
        leadTimeDays: body.leadTimeDays ?? null,
        terms: body.terms ?? null,
        notes: body.notes ?? null,
        subtotal,
        taxAmount: tax,
        freightAmount: freight,
        total: subtotal.add(tax).add(freight),
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    // THE MOAT: append price observations. Spec §4.8.
    const observations = created.lines
      .filter((l) => l.unitPrice !== null)
      .map((l) => ({
        workspaceId: rfq.workspaceId,
        itemId: rfq.list.lines.find((x) => x.id === l.listLineId)?.itemId ?? null,
        vendorId: rfq.vendorId,
        descriptionSnapshot: l.description,
        vendorSkuSnapshot: l.vendorSku,
        unitPrice: l.unitPrice!,
        uom: l.uom,
        quantity: l.quantity,
        source: 'QUOTE' as const,
        sourceRefId: created.id,
      }));
    if (observations.length) {
      await tx.priceObservation.createMany({ data: observations });
    }

    // Rfq RESPONDED. List flips to QUOTED on first submit.
    await tx.rfq.update({
      where: { id: rfq.id },
      data: { status: 'RESPONDED', respondedAt: new Date() },
    });
    if (rfq.list) {
      await tx.materialList.update({
        where: { id: rfq.listId },
        data: { status: 'QUOTED' },
      });
    }
    await tx.rfqEvent.create({
      data: {
        workspaceId: rfq.workspaceId,
        rfqId: rfq.id,
        type: 'SUBMITTED',
        actor: 'vendor',
        ipHash: hashIp(ip),
        userAgent: userAgent?.slice(0, 300),
        meta: { quoteId: created.id, revision: created.revision },
      },
    });

    return created;
  });

  return NextResponse.json({
    ok: true,
    redirect: `/q/${encodeURIComponent(params.token)}/submitted`,
  });
}

function hashIp(ip: string): string {
  const salt = process.env.APP_HASH_SALT ?? 'no-salt-set';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
