'use server';

/**
 * Procurement server actions — Vendor + Contact CRUD.
 *
 * Per spec §2.1 (tenant scoping): every mutation asserts the
 * signed-in user is a member of the workspace, and every
 * Prisma `where` includes the workspaceId. Errors are
 * returned as `{ ok: false, error }` so the calling form
 * component can show them inline.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { assertRole } from './auth';
import { type ActionResult } from './types';
export type { ActionResult } from './types';

// ---- vendor CRUD ----

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  legalName: z.string().max(200).optional().or(z.literal('')),
  accountNumber: z.string().max(80).optional().or(z.literal('')),
  capability: z.enum(['MANUAL', 'QUOTE_LINK', 'PUNCHOUT', 'API']).default('MANUAL'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  phone: z.string().max(40).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  addressLine1: z.string().max(200).optional().or(z.literal('')),
  addressLine2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(120).optional().or(z.literal('')),
  state: z.string().max(40).optional().or(z.literal('')),
  postalCode: z.string().max(20).optional().or(z.literal('')),
  defaultTerms: z.string().max(120).optional().or(z.literal('')),
  taxExempt: z.boolean().default(false),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export async function createVendorAction(
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

  const parsed = vendorSchema.safeParse({
    name: formData.get('name'),
    legalName: formData.get('legalName') ?? '',
    accountNumber: formData.get('accountNumber') ?? '',
    capability: formData.get('capability') ?? 'MANUAL',
    status: formData.get('status') ?? 'ACTIVE',
    phone: formData.get('phone') ?? '',
    website: formData.get('website') ?? '',
    addressLine1: formData.get('addressLine1') ?? '',
    addressLine2: formData.get('addressLine2') ?? '',
    city: formData.get('city') ?? '',
    state: formData.get('state') ?? '',
    postalCode: formData.get('postalCode') ?? '',
    defaultTerms: formData.get('defaultTerms') ?? '',
    taxExempt: formData.get('taxExempt') === 'on',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // Uniqueness check: (workspaceId, name) is unique on the
  // schema, but we also want a clean error message instead
  // of a Prisma raw error.
  const existing = await prisma.vendor.findFirst({
    where: { workspaceId, name: parsed.data.name, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `A vendor named "${parsed.data.name}" already exists in this workspace.`,
      fieldErrors: { name: 'Already exists' },
    };
  }

  const v = await prisma.vendor.create({
    data: {
      workspaceId,
      ...parsed.data,
      createdBy: userId,
      // Coerce empty strings → null for optional fields
      legalName: parsed.data.legalName || null,
      accountNumber: parsed.data.accountNumber || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      addressLine1: parsed.data.addressLine1 || null,
      addressLine2: parsed.data.addressLine2 || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      postalCode: parsed.data.postalCode || null,
      defaultTerms: parsed.data.defaultTerms || null,
      notes: parsed.data.notes || null,
    },
    select: { id: true },
  });

  revalidatePath(`/w/_/procurement/vendors`);
  return { ok: true, id: v.id };
}

const vendorUpdateSchema = vendorSchema.partial();
export async function updateVendorAction(
  workspaceId: string,
  vendorId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parsed = vendorUpdateSchema.safeParse({
    name: formData.get('name') || undefined,
    legalName: formData.get('legalName') ?? '',
    accountNumber: formData.get('accountNumber') ?? '',
    capability: formData.get('capability') ?? undefined,
    status: formData.get('status') ?? undefined,
    phone: formData.get('phone') ?? '',
    website: formData.get('website') ?? '',
    addressLine1: formData.get('addressLine1') ?? '',
    addressLine2: formData.get('addressLine2') ?? '',
    city: formData.get('city') ?? '',
    state: formData.get('state') ?? '',
    postalCode: formData.get('postalCode') ?? '',
    defaultTerms: formData.get('defaultTerms') ?? '',
    taxExempt: formData.get('taxExempt') === 'on',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // Tenant-scoped update — never let one workspace edit
  // another workspace's vendor.
  const result = await prisma.vendor.updateMany({
    where: { id: vendorId, workspaceId, deletedAt: null },
    data: {
      ...parsed.data,
      legalName: parsed.data.legalName || null,
      accountNumber: parsed.data.accountNumber || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      addressLine1: parsed.data.addressLine1 || null,
      addressLine2: parsed.data.addressLine2 || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      postalCode: parsed.data.postalCode || null,
      defaultTerms: parsed.data.defaultTerms || null,
      notes: parsed.data.notes || null,
    },
  });
  if (result.count === 0) {
    return { ok: false, error: 'Vendor not found' };
  }
  revalidatePath(`/w/_/procurement/vendors/${vendorId}`);
  revalidatePath(`/w/_/procurement/vendors`);
  return { ok: true };
}

export async function archiveVendorAction(
  workspaceId: string,
  vendorId: string,
): Promise<ActionResult> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  // Soft delete — preserve referential integrity with
  // historical RFQs/POs. The `deletedAt` filter on
  // every query keeps archived vendors out of pickers.
  const result = await prisma.vendor.updateMany({
    where: { id: vendorId, workspaceId, deletedAt: null },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });
  if (result.count === 0) {
    return { ok: false, error: 'Vendor not found' };
  }
  revalidatePath(`/w/_/procurement/vendors`);
  return { ok: true };
}

// ---- contact CRUD ----

const contactSchema = z.object({
  vendorId: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email required'),
  phone: z.string().max(40).optional().or(z.literal('')),
  role: z.string().max(80).optional().or(z.literal('')),
  isPrimary: z.boolean().default(false),
});

export async function createContactAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  const parsed = contactSchema.safeParse({
    vendorId: formData.get('vendorId'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') ?? '',
    role: formData.get('role') ?? '',
    isPrimary: formData.get('isPrimary') === 'on',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }
  // Tenant scoping: the vendor must belong to this workspace.
  const vendor = await prisma.vendor.findFirst({
    where: { id: parsed.data.vendorId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!vendor) return { ok: false, error: 'Vendor not found' };

  // If this is being set as primary, unset the others first.
  if (parsed.data.isPrimary) {
    await prisma.vendorContact.updateMany({
      where: { vendorId: parsed.data.vendorId, workspaceId },
      data: { isPrimary: false },
    });
  }

  const c = await prisma.vendorContact.create({
    data: {
      workspaceId,
      vendorId: parsed.data.vendorId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      role: parsed.data.role || null,
      isPrimary: parsed.data.isPrimary,
    },
    select: { id: true },
  });
  revalidatePath(`/w/_/procurement/vendors/${parsed.data.vendorId}`);
  return { ok: true, id: c.id };
}

export async function deleteContactAction(
  workspaceId: string,
  contactId: string,
): Promise<ActionResult> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  // Delete via the contact id; ensure tenant scope.
  const contact = await prisma.vendorContact.findFirst({
    where: { id: contactId, workspaceId },
    select: { vendorId: true },
  });
  if (!contact) return { ok: false, error: 'Contact not found' };
  await prisma.vendorContact.delete({ where: { id: contactId } });
  revalidatePath(`/w/_/procurement/vendors/${contact.vendorId}`);
  return { ok: true };
}

// ---- Vendor contact update ----
//
// Updates name / email / phone / role / isPrimary on an
// existing contact. Tenant-scoped via the contact's
// workspaceId. If isPrimary flips to true, all other
// primary contacts for that vendor are unset (one primary
// per vendor).

const contactUpdateSchema = z.object({
  contactId: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email required'),
  phone: z.string().max(40).optional().or(z.literal('')),
  role: z.string().max(80).optional().or(z.literal('')),
  isPrimary: z.boolean().default(false),
});

export async function updateContactAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parsed = contactUpdateSchema.safeParse({
    contactId: formData.get('contactId'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') ?? '',
    role: formData.get('role') ?? '',
    isPrimary: formData.get('isPrimary') === 'on',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // Tenant scope: confirm the contact belongs to this workspace.
  const existing = await prisma.vendorContact.findFirst({
    where: { id: parsed.data.contactId, workspaceId },
    select: { id: true, vendorId: true },
  });
  if (!existing) return { ok: false, error: 'Contact not found' };

  // If we're flipping this contact to primary, unset the
  // other primary contacts on the same vendor first.
  if (parsed.data.isPrimary) {
    await prisma.vendorContact.updateMany({
      where: {
        vendorId: existing.vendorId,
        workspaceId,
        id: { not: parsed.data.contactId },
      },
      data: { isPrimary: false },
    });
  }

  await prisma.vendorContact.update({
    where: { id: parsed.data.contactId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      role: parsed.data.role || null,
      isPrimary: parsed.data.isPrimary,
    },
  });
  revalidatePath(`/w/_/procurement/vendors/${existing.vendorId}`);
  return { ok: true };
}
