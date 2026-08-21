/**
 * Internal PO response actions.
 *
 * Buyer-side actions for handling vendor responses:
 *   - acceptCounter: counter is approved → create a new
 *     PO with the vendor's proposed values, cancel the
 *     old PO with a back-reference.
 *   - rejectCounter: counter is denied → keep the original
 *     PO as-is, mark the counter response as superseded.
 *   - uploadInvoice: PM uploads an invoice (PDF) on
 *     behalf of the vendor (backstop for email-to-PDF).
 *   - approveInvoice: PM signs off on a SUBMITTED invoice.
 *   - disputeInvoice: PM disputes (with reason).
 *   - markInvoicePaid: AP marks the invoice as paid with
 *     a payment method + reference #.
 *   - requestInvoice: PM emails the vendor asking them
 *     to send the invoice.
 *
 * All actions:
 *   1. Tenant-scope via workspace.findUnique({slug}).
 *   2. Role-gate to OWNER | ADMIN | PM (or OWNER | ADMIN
 *      for markInvoicePaid since that's an AP action).
 *   3. Write a PoEvent audit row.
 *   4. revalidatePath the relevant routes.
 *
 * The 'counter = new PO' model preserves audit history:
 * the original PO stays in the workspace with a
 * 'COUNTERED' event, the new PO has a back-reference
 * meta { supersededPoId } so the chain is traceable.
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { assertRole } from './auth';

// =====================================================================
//  Counter accept — creates a new PO with vendor's values, cancels old
// =====================================================================

const acceptCounterSchema = z.object({
  workspaceSlug: z.string().min(1),
  poId: z.string().min(1),
  responseId: z.string().min(1),
});

export type AcceptCounterResult =
  | { ok: true; newPoId: string; newPoNumber: string }
  | { ok: false; error: string };

export async function acceptCounterAction(
  input: z.infer<typeof acceptCounterSchema>,
): Promise<AcceptCounterResult> {
  const parsed = acceptCounterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input' };
  }
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  // Tenant-scope the PO.
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: parsed.data.poId, workspaceId: workspace.id },
    include: { lines: { orderBy: { position: 'asc' } } },
  });
  if (!po) return { ok: false, error: 'PO not found' };

  // Fetch the counter response.
  const response = await prisma.poVendorResponse.findFirst({
    where: { id: parsed.data.responseId, poId: po.id, workspaceId: workspace.id },
    include: { lines: true },
  });
  if (!response) return { ok: false, error: 'Response not found' };
  if (response.responseType !== 'COUNTERED') {
    return { ok: false, error: 'This response is not a counter' };
  }

  // Compute the new line items based on the response.
  const responseLineByPoLineId = new Map(response.lines.map((l) => [l.poLineId, l]));
  const newLines = po.lines
    .map((origLine) => {
      const r = responseLineByPoLineId.get(origLine.id);
      if (!r) return null;
      const qty = r.confirmedQty != null ? Number(r.confirmedQty) : Number(origLine.quantity);
      const price = r.confirmedPrice != null ? Number(r.confirmedPrice) : Number(origLine.unitPrice);
      const lineTotal = Math.round(qty * price * 10000) / 10000;
      return {
        position: origLine.position,
        itemId: origLine.itemId,
        description: r.substituteDescription || origLine.description,
        vendorSku: r.substituteSku || origLine.vendorSku,
        quantity: qty,
        uom: origLine.uom,
        unitPrice: price,
        lineTotal,
        isSubstitute: !!r.substituteSku,
        substituteNote: r.substituteSku
          ? `Vendor suggested substitute on counter response (${response.id})`
          : origLine.substituteNote,
        notes: r.notes || origLine.notes,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (newLines.length === 0) {
    return { ok: false, error: 'Counter response has no line changes' };
  }

  // Recompute subtotal.
  const subtotal = newLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const total = subtotal + Number(po.taxAmount) + Number(po.freightAmount);

  // Mint a new PO number. Use the existing race-safe pattern.
  const period = new Date().getFullYear().toString();
  const result = await prisma.$transaction(async (tx) => {
    // Bump the doc counter.
    const counter = await tx.docCounter.upsert({
      where: {
        workspaceId_docType_period: {
          workspaceId: workspace.id,
          docType: 'PO',
          period,
        },
      },
      create: { workspaceId: workspace.id, docType: 'PO', period, value: 1 },
      update: { value: { increment: 1 } },
    });
    const newNumber = `PO-${period}-${String(counter.value).padStart(4, '0')}`;

    // Create the new PO. status starts at DRAFT — buyer
    // will re-issue it after review. Same vendor, project,
    // delivery, terms. The new PO has a back-reference to
    // the old one via meta on the COUNTER_ACCEPTED event.
    const newPo = await tx.purchaseOrder.create({
      data: {
        workspaceId: workspace.id,
        number: newNumber,
        vendorId: po.vendorId,
        // quoteId is left null — this is a new commitment,
        // not a re-issue of the original quote.
        projectId: po.projectId,
        costCode: po.costCode,
        status: 'DRAFT',
        subtotal: subtotal as unknown as Prisma.Decimal,
        taxAmount: po.taxAmount,
        freightAmount: po.freightAmount,
        total: Math.round(total * 100) / 100,
        currency: po.currency,
        terms: po.terms,
        shipTo: po.shipTo,
        neededBy: po.neededBy,
        notes: po.notes,
        deliveryName: po.deliveryName,
        deliveryAddress: po.deliveryAddress,
        deliveryContactName: po.deliveryContactName,
        deliveryContactPhone: po.deliveryContactPhone,
        deliveryContactEmail: po.deliveryContactEmail,
        // Carry the same payment preference forward.
        paymentMethodChosen: po.paymentMethodChosen,
        paymentMethodDetail: po.paymentMethodDetail,
        vendorReference: po.vendorReference,
        createdBy: po.createdBy,
        lines: {
          create: newLines as unknown as Prisma.POLineCreateWithoutPoInput[],
        },
      },
      select: { id: true, number: true },
    });

    // Cancel the old PO with a back-reference.
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CANCELLED', lastActivityAt: new Date() },
    });

    // Audit events on BOTH POs.
    await tx.poEvent.create({
      data: {
        workspaceId: workspace.id,
        poId: newPo.id,
        type: 'COUNTER_ACCEPTED',
        meta: {
          supersededPoId: po.id,
          supersededPoNumber: po.number,
          responseId: response.id,
          newLinesCount: newLines.length,
        },
      },
    });
    await tx.poEvent.create({
      data: {
        workspaceId: workspace.id,
        poId: po.id,
        type: 'COUNTER_ACCEPTED',
        meta: {
          supersededByPoId: newPo.id,
          supersededByPoNumber: newPo.number,
          responseId: response.id,
        },
      },
    });

    return newPo;
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos`);
  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos/${po.id}`);
  return { ok: true, newPoId: result.id, newPoNumber: result.number };
}

// =====================================================================
//  Counter reject — keep original PO, mark counter as superseded
// =====================================================================

const rejectCounterSchema = z.object({
  workspaceSlug: z.string().min(1),
  poId: z.string().min(1),
  responseId: z.string().min(1),
  reason: z.string().min(1, 'Reason is required').max(2000),
});

export type RejectCounterResult = { ok: true } | { ok: false; error: string };

export async function rejectCounterAction(
  input: z.infer<typeof rejectCounterSchema>,
): Promise<RejectCounterResult> {
  const parsed = rejectCounterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Reason is required' };
  }
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  // Tenant-scope.
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: parsed.data.poId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!po) return { ok: false, error: 'PO not found' };

  const response = await prisma.poVendorResponse.findFirst({
    where: { id: parsed.data.responseId, poId: po.id, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!response) return { ok: false, error: 'Response not found' };

  // No state change on the PO — it stays ISSUED. We log
  // the rejection; the vendor can re-submit a new counter
  // or accept the original.
  await prisma.poEvent.create({
    data: {
      workspaceId: workspace.id,
      poId: po.id,
      type: 'COUNTER_REJECTED',
      actor: userId,
      meta: {
        responseId: response.id,
        reason: parsed.data.reason,
      },
    },
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos/${po.id}`);
  return { ok: true };
}
