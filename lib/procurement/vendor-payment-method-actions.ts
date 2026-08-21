/**
 * Vendor payment methods CRUD — ACH / CARD / CHECK.
 *
 * We never store the full account/card number. Only last
 * 4 digits + brand/bank metadata. The full number lives
 * in the vendor's own records.
 *
 * Set-default: at most one method per vendor can be default.
 * When toggling isDefault=true on a new row, the old default
 * is unset atomically.
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { assertRole } from './auth';

// ── Add method ─────────────────────────────────────────────

const addSchema = z
  .object({
    workspaceSlug: z.string().min(1),
    vendorId: z.string().min(1),
    methodType: z.enum(['ACH', 'CARD', 'CHECK']),
    nickname: z.string().max(120).optional(),
    last4: z.string().max(4).optional(),
    achBankName: z.string().max(120).optional(),
    achRoutingLast4: z.string().max(4).optional(),
    achAccountLast4: z.string().max(4).optional(),
    cardBrand: z.string().max(40).optional(),
  })
  .refine(
    (d) => {
      // Account/card last 4 required for the methods that need it.
      if (d.methodType === 'ACH' && !d.achAccountLast4) return false;
      if (d.methodType === 'CARD' && !d.last4) return false;
      if (d.methodType === 'CHECK' && !d.last4) return false;
      return true;
    },
    { message: 'Last 4 digits are required for ACH / card / check' },
  );

export async function addVendorPaymentMethodAction(
  input: z.input<typeof addSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  // Confirm vendor belongs to this workspace.
  const vendor = await prisma.vendor.findFirst({
    where: { id: parsed.data.vendorId, workspaceId: workspace.id, deletedAt: null },
    select: { id: true },
  });
  if (!vendor) return { ok: false, error: 'Vendor not found' };

  // First method on the vendor becomes the default.
  const existing = await prisma.vendorPaymentMethod.count({
    where: { vendorId: vendor.id, isActive: true },
  });
  const isDefault = existing === 0;

  await prisma.vendorPaymentMethod.create({
    data: {
      workspaceId: workspace.id,
      vendorId: vendor.id,
      methodType: parsed.data.methodType,
      isDefault,
      nickname: parsed.data.nickname ?? null,
      last4: parsed.data.last4 ?? null,
      achBankName: parsed.data.achBankName ?? null,
      achRoutingLast4: parsed.data.achRoutingLast4 ?? null,
      achAccountLast4: parsed.data.achAccountLast4 ?? null,
      cardBrand: parsed.data.cardBrand ?? null,
    },
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/settings/payments`);
  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/vendors/${vendor.id}`);
  return { ok: true };
}

// ── Set default ────────────────────────────────────────────

const setDefaultSchema = z.object({
  workspaceSlug: z.string().min(1),
  vendorId: z.string().min(1),
  methodId: z.string().min(1),
});

export async function setDefaultVendorPaymentMethodAction(
  input: z.input<typeof setDefaultSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  // Tenant-scope the method.
  const method = await prisma.vendorPaymentMethod.findFirst({
    where: { id: parsed.data.methodId, workspaceId: workspace.id, vendorId: parsed.data.vendorId },
    select: { id: true },
  });
  if (!method) return { ok: false, error: 'Method not found' };

  // Atomic demote / promote.
  await prisma.$transaction([
    prisma.vendorPaymentMethod.updateMany({
      where: { vendorId: parsed.data.vendorId, workspaceId: workspace.id },
      data: { isDefault: false },
    }),
    prisma.vendorPaymentMethod.update({
      where: { id: method.id },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath(`/w/${parsed.data.workspaceSlug}/settings/payments`);
  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/vendors/${parsed.data.vendorId}`);
  return { ok: true };
}

// ── Toggle active ──────────────────────────────────────────

const toggleSchema = z.object({
  workspaceSlug: z.string().min(1),
  methodId: z.string().min(1),
  isActive: z.boolean(),
});

export async function toggleVendorPaymentMethodAction(
  input: z.input<typeof toggleSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const result = await prisma.vendorPaymentMethod.updateMany({
    where: { id: parsed.data.methodId, workspaceId: workspace.id },
    data: { isActive: parsed.data.isActive },
  });
  if (result.count === 0) return { ok: false, error: 'Method not found' };

  revalidatePath(`/w/${parsed.data.workspaceSlug}/settings/payments`);
  return { ok: true };
}

// ── Delete ─────────────────────────────────────────────────

const deleteSchema = z.object({
  workspaceSlug: z.string().min(1),
  methodId: z.string().min(1),
});

export async function deleteVendorPaymentMethodAction(
  input: z.input<typeof deleteSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  // Don't allow deleting the last active method — vendor
  // would have no way to receive payment.
  const method = await prisma.vendorPaymentMethod.findFirst({
    where: { id: parsed.data.methodId, workspaceId: workspace.id },
    select: { id: true, vendorId: true, isActive: true },
  });
  if (!method) return { ok: false, error: 'Method not found' };
  if (method.isActive) {
    const others = await prisma.vendorPaymentMethod.count({
      where: {
        vendorId: method.vendorId,
        workspaceId: workspace.id,
        isActive: true,
        id: { not: method.id },
      },
    });
    if (others === 0) {
      return { ok: false, error: 'Cannot delete the last active method. Add a replacement first.' };
    }
  }

  await prisma.vendorPaymentMethod.delete({ where: { id: method.id } });
  revalidatePath(`/w/${parsed.data.workspaceSlug}/settings/payments`);
  return { ok: true };
}
