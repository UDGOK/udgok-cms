'use server';

/**
 * PO actions.
 *
 * Per spec §10.1 — accept a quote and create a PO atomically.
 * In v1 we support **single-vendor** accept (per-RFQ). Mixed
 * award is implemented in the compare page: when the user
 * picks lines from multiple vendors and clicks "Award", we
 * call acceptQuoteAndCreatePo once per vendor. Each call
 * writes one PO. The unique-quote constraint on
 * PurchaseOrder.quoteId means we can't double-PO a quote.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { assertRole } from './auth';
import { nextDocNumber } from './number';
import type { ActionResult } from './types';

const acceptSchema = z.object({
  rfqId: z.string().min(1),
});

export async function acceptQuoteAndCreatePoAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ poId: string; poNumber: string; total: number }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parsed = acceptSchema.safeParse({ rfqId: formData.get('rfqId') });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const po = await prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findFirst({
      where: { id: parsed.data.rfqId, workspaceId },
      include: {
        vendor: { select: { id: true, name: true, defaultTerms: true } },
        list: { select: { id: true, name: true, deliverTo: true } },
        contact: { select: { email: true, name: true } },
        quotes: {
          where: { status: 'SUBMITTED' },
          orderBy: { revision: 'desc' },
          take: 1,
          include: { lines: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!rfq) throw new Error('RFQ not found');
    const quote = rfq.quotes[0];
    if (!quote) throw new Error('No submitted quote on this RFQ');
    if (rfq.status === 'ACCEPTED') throw new Error('RFQ already accepted');
    if (quote.status !== 'SUBMITTED') throw new Error('Quote is not open');

    const number = await nextDocNumber(tx, workspaceId, 'PO');

    // Include only lines with a price AND available. Spec §10.1.
    const lines = quote.lines
      .filter((l) => l.available && l.unitPrice !== null)
      .map((l, i) => ({
        workspaceId,
        position: i,
        description: l.description,
        vendorSku: l.vendorSku,
        quantity: l.quantity,
        uom: l.uom,
        unitPrice: l.unitPrice!,
        lineTotal: l.unitPrice!.mul(l.quantity),
        isSubstitute: l.isSubstitute,
        substituteNote: l.substituteNote,
        notes: l.notes,
      }));

    if (lines.length === 0) throw new Error('No available priced lines on this quote');

    const subtotal = lines.reduce(
      (a, l) => a.add(l.lineTotal),
      new Prisma.Decimal(0),
    );

    const created = await tx.purchaseOrder.create({
      data: {
        workspaceId,
        number,
        vendorId: rfq.vendor.id,
        quoteId: quote.id,
        projectId: null, // Phase 1 — populated in Phase 2
        status: 'PENDING_APPROVAL', // needs OWNER/ADMIN/PM to issue
        subtotal,
        taxAmount: quote.taxAmount,
        freightAmount: quote.freightAmount,
        total: subtotal.add(quote.taxAmount).add(quote.freightAmount),
        terms: quote.terms ?? rfq.vendor.defaultTerms ?? null,
        shipTo: rfq.list.deliverTo,
        notes: quote.notes,
        lines: { create: lines },
      },
      include: { lines: true },
    });

    await tx.vendorQuote.update({
      where: { id: quote.id },
      data: { status: 'ACCEPTED' },
    });
    await tx.rfq.update({
      where: { id: rfq.id },
      data: { status: 'ACCEPTED' },
    });
    await tx.rfqEvent.create({
      data: {
        workspaceId,
        rfqId: rfq.id,
        type: 'ACCEPTED',
        actor: userId,
        meta: { poId: created.id, poNumber: created.number },
      },
    });

    return created;
  }).catch((e) => {
    return { __error: e instanceof Error ? e.message : 'Failed' };
  });

  if ('__error' in po) {
    return { ok: false, error: po.__error };
  }

  revalidatePath(`/w/_/procurement/rfqs/${parsed.data.rfqId}`);
  revalidatePath(`/w/_/procurement/lists/${po.number}`);
  revalidatePath(`/w/_/procurement/pos/${po.id}`);

  return {
    ok: true,
    poId: po.id,
    poNumber: po.number,
    total: Number(po.total),
  };
}

const issueSchema = z.object({
  poId: z.string().min(1),
});

/** Approve + issue. OWNER/ADMIN/PM (same gate as accept — v1
 *  keeps the workflow simple). */
export async function issuePoAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parsed = issueSchema.safeParse({ poId: formData.get('poId') });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await prisma.purchaseOrder.updateMany({
    where: { id: parsed.data.poId, workspaceId, status: 'PENDING_APPROVAL' },
    data: { status: 'ISSUED', issuedAt: new Date(), issuedBy: userId },
  });
  if (result.count === 0) return { ok: false, error: 'PO not in PENDING_APPROVAL' };

  revalidatePath(`/w/_/procurement/pos/${parsed.data.poId}`);
  return { ok: true };
}

/** Cancel a PO (only valid before ISSUED). */
export async function cancelPoAction(
  workspaceId: string,
  poId: string,
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const result = await prisma.purchaseOrder.updateMany({
    where: { id: poId, workspaceId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
    data: { status: 'CANCELLED' },
  });
  if (result.count === 0) return { ok: false, error: 'PO not found or already issued' };
  revalidatePath(`/w/_/procurement/pos/${poId}`);
  return { ok: true };
}
