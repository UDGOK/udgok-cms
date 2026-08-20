'use server';

/**
 * PO edit actions.
 *
 * POs are editable while in PENDING_APPROVAL status. Once
 * ISSUED, they become a binding commitment to the vendor
 * and shouldn't be silently mutated — re-issue or cancel
 * + recreate instead.
 *
 * All mutations:
 *   - assert OWNER | ADMIN | PM
 *   - tenant-scope the PO lookup
 *   - recompute money server-side from quantity × unitPrice
 *   - write a row to the activity log (not implemented
 *     here — would be a follow-up; for now the PoRevision
 *     audit comes from the original quote's revision
 *     field being preserved on the QUOTE)
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { assertRole } from './auth';
import type { ActionResult } from './types';

const lineEditSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500).optional(),
  quantity: z.coerce.number().positive().max(1_000_000).optional(),
  unitPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  vendorSku: z.string().max(100).nullable().optional(),
  uom: z.string().min(1).max(20).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const editPoSchema = z.object({
  poId: z.string().min(1),
  // Replace the entire lines array. Caller is the form;
  // it manages which lines exist via add/remove.
  lines: z.array(lineEditSchema).max(200),
  // Top-level edits
  shipTo: z.string().max(500).nullable().optional(),
  terms: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  freightAmount: z.coerce.number().min(0).max(1_000_000).optional(),
  taxAmount: z.coerce.number().min(0).max(1_000_000).optional(),
  // Delivery fields (where the driver physically drops off)
  deliveryName: z.string().max(200).nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  deliveryContactName: z.string().max(200).nullable().optional(),
  deliveryContactPhone: z.string().max(50).nullable().optional(),
  deliveryContactEmail: z.string().max(200).nullable().optional(),
});

/**
 * Edit a PO that's still in PENDING_APPROVAL. Replaces all
 * lines with the provided set (caller manages which lines
 * stay via add/remove). Recomputes line totals + grand
 * totals server-side.
 */
export async function editPoAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ poId: string; total: number; lineCount: number }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Missing payload' };
  }
  let parsed: z.infer<typeof editPoSchema>;
  try {
    parsed = editPoSchema.parse(JSON.parse(raw));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid payload' };
  }

  const result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: parsed.poId, workspaceId },
      include: { lines: true },
    });
    if (!po) throw new Error('PO not found');
    if (po.status !== 'PENDING_APPROVAL' && po.status !== 'DRAFT') {
      throw new Error(`PO is ${po.status} and can no longer be edited. Cancel and recreate instead.`);
    }

    // Tenant scope: every incoming line.id must already exist
    // on this PO. New lines have no id; we'll create them.
    const existingById = new Map(po.lines.map((l) => [l.id, l]));
    const incomingIds = new Set<string>();
    for (const l of parsed.lines) {
      if (l.id) incomingIds.add(l.id);
    }
    for (const id of incomingIds) {
      if (!existingById.has(id)) {
        throw new Error(`Line ${id} does not belong to this PO`);
      }
    }

    // Diff tracking for the PoEvent log. The buyer can
    // see "added 2 lines, removed 1, modified 3" without
    // diffing the line table themselves.
    const addedLineIds: string[] = [];
    const modifiedLineIds: string[] = [];
    const removedLineIds: string[] = po.lines
      .filter((l) => !incomingIds.has(l.id))
      .map((l) => l.id);

    // Delete lines that are no longer in the incoming set.
    const toDelete = po.lines.filter((l) => !incomingIds.has(l.id));
    if (toDelete.length > 0) {
      await tx.pOLine.deleteMany({
        where: { id: { in: toDelete.map((l) => l.id) } },
      });
    }

    // Upsert remaining lines + create new ones.
    let nextPosition = 0;
    let subtotal = new Prisma.Decimal(0);
    for (const incoming of parsed.lines) {
      const isNew = !incoming.id || !existingById.has(incoming.id);
      const existing = incoming.id ? existingById.get(incoming.id) : null;

      const description = incoming.description ?? existing?.description ?? '';
      const quantity = incoming.quantity ?? (existing ? Number(existing.quantity) : 1);
      const unitPrice = incoming.unitPrice ?? (existing ? Number(existing.unitPrice) : 0);
      const uom = incoming.uom ?? existing?.uom ?? 'EA';
      const lineTotal = new Prisma.Decimal(unitPrice).mul(quantity);
      subtotal = subtotal.add(lineTotal);

      if (isNew) {
        const created = await tx.pOLine.create({
          data: {
            workspaceId,
            poId: po.id,
            position: nextPosition,
            description,
            quantity: new Prisma.Decimal(quantity),
            uom,
            unitPrice: new Prisma.Decimal(unitPrice),
            lineTotal,
            vendorSku: incoming.vendorSku ?? null,
            notes: incoming.notes ?? null,
          },
        });
        addedLineIds.push(created.id);
      } else if (existing) {
        // Track modifications — anything that changes the
        // numbers (qty, unit price) or the description
        // counts as a modification for the audit log.
        const existingQty = Number(existing.quantity);
        const existingPrice = Number(existing.unitPrice);
        const modified =
          existingQty !== quantity ||
          existingPrice !== unitPrice ||
          existing.description !== description;
        await tx.pOLine.update({
          where: { id: existing.id },
          data: {
            position: nextPosition,
            description,
            quantity: new Prisma.Decimal(quantity),
            uom,
            unitPrice: new Prisma.Decimal(unitPrice),
            lineTotal,
            vendorSku: incoming.vendorSku ?? existing.vendorSku,
            notes: incoming.notes ?? existing.notes,
          },
        });
        if (modified) modifiedLineIds.push(existing.id);
      }
      nextPosition += 1;
    }

    const freightAmount = new Prisma.Decimal(parsed.freightAmount ?? Number(po.freightAmount));
    const taxAmount = new Prisma.Decimal(parsed.taxAmount ?? Number(po.taxAmount));
    const newTotal = subtotal.add(freightAmount).add(taxAmount);

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        shipTo: parsed.shipTo ?? po.shipTo,
        terms: parsed.terms ?? po.terms,
        notes: parsed.notes ?? po.notes,
        freightAmount,
        taxAmount,
        subtotal,
        total: newTotal,
        // Delivery fields. Using `?? po.<field>` so the
        // caller can pass `null` to clear a field.
        deliveryName: parsed.deliveryName !== undefined ? parsed.deliveryName : po.deliveryName,
        deliveryAddress:
          parsed.deliveryAddress !== undefined ? parsed.deliveryAddress : po.deliveryAddress,
        deliveryContactName:
          parsed.deliveryContactName !== undefined
            ? parsed.deliveryContactName
            : po.deliveryContactName,
        deliveryContactPhone:
          parsed.deliveryContactPhone !== undefined
            ? parsed.deliveryContactPhone
            : po.deliveryContactPhone,
        deliveryContactEmail:
          parsed.deliveryContactEmail !== undefined
            ? parsed.deliveryContactEmail
            : po.deliveryContactEmail,
      },
    });

    // PoEvent: EDITED. Only write if anything actually
    // changed — saves on log noise when the buyer clicks
    // "Save" without making changes.
    const changed =
      addedLineIds.length > 0 ||
      modifiedLineIds.length > 0 ||
      removedLineIds.length > 0 ||
      po.shipTo !== (parsed.shipTo ?? po.shipTo) ||
      po.terms !== (parsed.terms ?? po.terms) ||
      po.notes !== (parsed.notes ?? po.notes) ||
      po.deliveryName !== (parsed.deliveryName !== undefined ? parsed.deliveryName : po.deliveryName) ||
      po.deliveryAddress !== (parsed.deliveryAddress !== undefined ? parsed.deliveryAddress : po.deliveryAddress);
    if (changed) {
      await tx.poEvent.create({
        data: {
          workspaceId,
          poId: po.id,
          type: 'EDITED',
          actor: userId,
          meta: {
            added: addedLineIds,
            modified: modifiedLineIds,
            removed: removedLineIds,
            newTotal: Number(newTotal),
            newSubtotal: Number(subtotal),
          },
        },
      });
    }

    return { lineCount: parsed.lines.length, total: Number(newTotal) };
  }).catch((e) => {
    return { __error: e instanceof Error ? e.message : 'Edit failed' };
  });

  if ('__error' in result) {
    return { ok: false, error: result.__error };
  }

  revalidatePath(`/w/_/procurement/pos/${parsed.poId}`);
  return {
    ok: true,
    poId: parsed.poId,
    lineCount: result.lineCount,
    total: result.total,
  };
}
