'use server';

/**
 * MaterialList server actions — list + line CRUD.
 *
 * Phase 1: build a list, add free-text lines, edit / delete
 * lines, mark a list "ready to send" (DRAFT → QUOTING in
 * Phase 2 when the RFQ send path lands).
 *
 * Money is Decimal(19,4). Quantities are Decimal(19,4).
 * We recompute line totals on the server from
 * quantity × unitPrice in case a future column is added.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { assertRole } from './auth';
import { UOMS, type ActionResult } from './types';
export type { ActionResult } from './types';

const uomSchema = z
  .string()
  .min(1)
  .max(20)
  .refine(
    (s) => UOMS.includes(s as (typeof UOMS)[number]) || s.length <= 20,
    'UoM must be one of the standard codes (EA, BOX, LF, SF, CY, HR, ROLL, BUNDLE, PAIL) or a short custom value',
  );

const createListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  neededBy: z.string().optional(),
  deliverTo: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createMaterialListAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parsed = createListSchema.safeParse({
    name: formData.get('name'),
    neededBy: formData.get('neededBy') || undefined,
    deliverTo: formData.get('deliverTo') || undefined,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  const list = await prisma.materialList.create({
    data: {
      workspaceId,
      name: parsed.data.name,
      createdBy: userId,
      neededBy: parsed.data.neededBy ? new Date(parsed.data.neededBy) : null,
      deliverTo: parsed.data.deliverTo || null,
      notes: parsed.data.notes || null,
    },
    select: { id: true },
  });
  revalidatePath(`/w/_/procurement/lists`);
  return { ok: true, id: list.id };
}

const lineSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? parseFloat(v) : v))
    .refine((n) => Number.isFinite(n) && n > 0, 'Quantity must be > 0'),
  uom: uomSchema,
  manufacturer: z.string().max(200).optional(),
  mfrPartNumber: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export async function addListLineAction(
  workspaceId: string,
  listId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parsed = lineSchema.safeParse({
    description: formData.get('description'),
    quantity: formData.get('quantity') || 1,
    uom: formData.get('uom') || 'EA',
    manufacturer: formData.get('manufacturer') || undefined,
    mfrPartNumber: formData.get('mfrPartNumber') || undefined,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // Tenant scope + position. The position is max+1.
  const list = await prisma.materialList.findFirst({
    where: { id: listId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!list) return { ok: false, error: 'List not found' };

  const nextPosition = await prisma.materialListLine.aggregate({
    where: { listId },
    _max: { position: true },
  });
  const position = (nextPosition._max.position ?? 0) + 1;

  const line = await prisma.materialListLine.create({
    data: {
      workspaceId,
      listId,
      position,
      description: parsed.data.description,
      quantity: parsed.data.quantity,
      uom: parsed.data.uom,
      manufacturer: parsed.data.manufacturer || null,
      mfrPartNumber: parsed.data.mfrPartNumber || null,
      notes: parsed.data.notes || null,
    },
    select: { id: true },
  });
  revalidatePath(`/w/_/procurement/lists/${listId}`);
  return { ok: true, id: line.id };
}

export async function deleteListLineAction(
  workspaceId: string,
  listId: string,
  lineId: string,
): Promise<ActionResult> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  // Tenant-scoped delete — never trust the lineId alone.
  const result = await prisma.materialListLine.deleteMany({
    where: { id: lineId, listId, workspaceId },
  });
  if (result.count === 0) return { ok: false, error: 'Line not found' };
  revalidatePath(`/w/_/procurement/lists/${listId}`);
  return { ok: true };
}

export async function archiveListAction(
  workspaceId: string,
  listId: string,
): Promise<ActionResult> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  const result = await prisma.materialList.updateMany({
    where: { id: listId, workspaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: 'List not found' };
  revalidatePath(`/w/_/procurement/lists`);
  return { ok: true };
}
