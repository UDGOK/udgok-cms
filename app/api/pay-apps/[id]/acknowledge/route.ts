/**
 * Public pay-app acknowledge — called from /pay-apps/[token] when
 * the recipient clicks "I acknowledge this draw".
 *
 * Security model: the pay app is identified by its shareToken (not
 * its database id). The browser passes the token in the body; the
 * route looks up the pay app by shareToken, verifies the URL's `id`
 * param matches the looked-up pay app's id, and only then updates.
 *
 * This prevents two classes of abuse:
 *   1. Unauthenticated access — the token is a 32-byte random string
 *      that only the recipient of the share link has.
 *   2. Cross-pay-app — knowing one pay app's id doesn't let you
 *      acknowledge a different one, because the lookup is by token.
 *
 * The middleware also lists `/api/pay-apps/(.*)/acknowledge` in
 * `isPublicRoute` so the unauthenticated browser request reaches
 * here. Verification happens in this handler, not in the middleware.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';

const bodySchema = z.object({
  token: z.string().min(8, 'Token required'),
  email: z.string().email().optional().nullable(),
  name: z.string().max(200).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.issues.slice(0, 3) },
      { status: 400 },
    );
  }

  // Look up the pay app by its share token, NOT by id. The token
  // is the credential; the id is the resource identifier. Both
  // must agree for the request to be valid.
  const payApp = await prisma.payApp.findUnique({
    where: { shareToken: parsed.data.token },
    select: {
      id: true,
      status: true,
      acknowledgedAt: true,
    },
  });
  if (!payApp) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }
  if (payApp.id !== params.id) {
    // The token and the URL id refer to different pay apps. This
    // is a tampering attempt — return 404, not 403, so we don't
    // leak whether the token exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Don't re-acknowledge a draft. (Mirrors the old behavior.)
  // Also don't re-acknowledge something that's already paid.
  if (payApp.status === 'DRAFT') {
    return NextResponse.json({ error: 'Pay app is still a draft' }, { status: 400 });
  }
  if (payApp.status === 'PAID') {
    return NextResponse.json({ error: 'Pay app is already paid' }, { status: 409 });
  }

  // Idempotent: re-acknowledging an already-acknowledged pay app
  // is a no-op success (the user clicked the button twice).
  const acknowledgedAt = payApp.acknowledgedAt ?? new Date();

  await prisma.payApp.update({
    where: { id: payApp.id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt,
      // Record who acknowledged, if they gave us an email. Stored
      // on the PayApp itself; we don't need a separate event table
      // for this (unlike views, which can be many).
      acknowledgedByEmail: parsed.data.email ?? null,
      acknowledgedByName: parsed.data.name ?? null,
    },
  });

  return NextResponse.json({ ok: true, acknowledgedAt: acknowledgedAt.toISOString() });
}
