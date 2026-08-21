/**
 * Internal PO invoice actions.
 *
 * Buyer-side actions for handling vendor invoices:
 *   - requestInvoiceFromVendor: send a "please invoice us"
 *     email to the vendor's primary contact.
 *   - uploadInvoice: PM uploads a PDF (from email) — creates
 *     a PoInvoice row + writes a PoEvent.
 *   - approveInvoice: PM signs off on a SUBMITTED invoice.
 *   - disputeInvoice: PM disputes (with reason) — sends a
 *     "your invoice was disputed" email to the vendor.
 *   - markInvoicePaid: AP records payment with method + ref.
 *
 * Tenant-scoped, role-gated, audit-logged.
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { assertRole } from './auth';
import { sendVendorResponseNotification } from './email';
import { resolvePoPortalUrl } from './portal-url';

// =====================================================================
//  Request invoice from vendor — sends an email + PoEvent
// =====================================================================

const requestInvoiceSchema = z.object({
  workspaceSlug: z.string().min(1),
  poId: z.string().min(1),
});

export async function requestInvoiceAction(
  input: z.infer<typeof requestInvoiceSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = requestInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: parsed.data.poId, workspaceId: workspace.id },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          contacts: {
            where: { id: { not: undefined } },
            orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
            take: 1,
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
      workspace: { select: { name: true, paymentSettings: true } },
    },
  });
  if (!po) return { ok: false, error: 'PO not found' };
  // Cast workaround: Prisma return-type narrowing after
  // schema migration. See agent memory.
  const poFull = po as unknown as NonNullable<typeof po> & {
    vendorPortalToken: string | null;
  };
  const contact = po.vendor.contacts[0] ?? null;

  // Send email to the vendor's primary contact (or any
  // contact if no primary). Falls back to no-op if no
  // contact email is on file.
  const toEmail = contact?.email;
  if (toEmail) {
    const portalUrl = poFull.vendorPortalToken
      ? resolvePoPortalUrl(poFull.vendorPortalToken)
      : null;
    const invoiceEmail = po.workspace.paymentSettings?.invoiceEmail ?? 'ap@udgok.com';
    await sendVendorResponseNotification({
      to: toEmail,
      subject: `Invoice needed for ${po.number}`,
      workspaceName: po.workspace.name,
      poNumber: po.number,
      vendorName: po.vendor.name,
      responseType: 'INVOICE_REQUEST',
      paymentMethod: poFull.paymentMethodChosen ?? 'INVOICE_BY_EMAIL',
      portalUrl,
      invoiceEmail,
      lineCount: 0,
    }).catch((e) => {
      // Email failure should not block the audit log.
      console.error('[po-invoice-actions] request-invoice email failed:', e);
    });
  }

  await prisma.poEvent.create({
    data: {
      workspaceId: workspace.id,
      poId: po.id,
      type: 'INVOICE_REQUESTED',
      actor: userId,
      meta: {
        toEmail: toEmail ?? null,
        vendorContactId: contact?.id ?? null,
      },
    },
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos/${po.id}`);
  return { ok: true };
}

// =====================================================================
//  Upload invoice (PM does this on behalf of vendor)
// =====================================================================

const uploadInvoiceSchema = z.object({
  workspaceSlug: z.string().min(1),
  poId: z.string().min(1),
  invoiceNumber: z.string().min(1, 'Invoice number required').max(120),
  invoiceDate: z.string().min(1, 'Invoice date required'),
  invoiceAmount: z.coerce.number().min(0),
  notes: z.string().max(2000).optional().or(z.literal('')),
  submittedByEmail: z.string().email().optional().or(z.literal('')),
  pdfBlobPathname: z.string().max(500).optional().or(z.literal('')),
});

export type UploadInvoiceInput = z.infer<typeof uploadInvoiceSchema>;
export type UploadInvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function uploadInvoiceAction(
  input: UploadInvoiceInput,
): Promise<UploadInvoiceResult> {
  const parsed = uploadInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
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

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: parsed.data.poId, workspaceId: workspace.id },
    select: { id: true, number: true },
  });
  if (!po) return { ok: false, error: 'PO not found' };

  // Reject duplicate invoice number per PO.
  const dup = await prisma.poInvoice.findFirst({
    where: {
      workspaceId: workspace.id,
      poId: po.id,
      invoiceNumber: parsed.data.invoiceNumber,
      status: { not: 'VOID' },
    },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: 'An invoice with this number is already on file for this PO.',
      fieldErrors: { invoiceNumber: 'Duplicate invoice number' },
    };
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.poInvoice.create({
      data: {
        workspaceId: workspace.id,
        poId: po.id,
        invoiceNumber: parsed.data.invoiceNumber,
        invoiceDate: new Date(parsed.data.invoiceDate),
        invoiceAmount: parsed.data.invoiceAmount,
        submittedByEmail: parsed.data.submittedByEmail || 'manual upload',
        pdfBlobPathname: parsed.data.pdfBlobPathname || null,
        notes: parsed.data.notes || null,
        status: 'SUBMITTED',
      },
      select: { id: true },
    });
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { invoiceId: inv.id, lastActivityAt: new Date() },
    });
    await tx.poEvent.create({
      data: {
        workspaceId: workspace.id,
        poId: po.id,
        type: 'INVOICE_RECEIVED',
        actor: userId,
        meta: {
          invoiceId: inv.id,
          invoiceNumber: parsed.data.invoiceNumber,
          amount: parsed.data.invoiceAmount,
        },
      },
    });
    return inv;
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos/${po.id}`);
  return { ok: true, invoiceId: invoice.id };
}

// =====================================================================
//  Approve / dispute / mark paid
// =====================================================================

const invoiceActionSchema = z.object({
  workspaceSlug: z.string().min(1),
  invoiceId: z.string().min(1),
  reason: z.string().max(2000).optional().or(z.literal('')),
});

export async function approveInvoiceAction(
  input: z.infer<typeof invoiceActionSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = invoiceActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const inv = await prisma.poInvoice.findFirst({
    where: { id: parsed.data.invoiceId, workspaceId: workspace.id },
    select: { id: true, poId: true, status: true },
  });
  if (!inv) return { ok: false, error: 'Invoice not found' };
  if (inv.status !== 'SUBMITTED' && inv.status !== 'DISPUTED') {
    return { ok: false, error: `Cannot approve an invoice in ${inv.status} state` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.poInvoice.update({
      where: { id: inv.id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId, disputedAt: null, disputedReason: null },
    });
    await tx.poEvent.create({
      data: {
        workspaceId: workspace.id,
        poId: inv.poId,
        type: 'INVOICE_APPROVED',
        actor: userId,
        meta: { invoiceId: inv.id },
      },
    });
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos/${inv.poId}`);
  return { ok: true };
}

export async function disputeInvoiceAction(
  input: z.infer<typeof invoiceActionSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = invoiceActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  if (!parsed.data.reason) return { ok: false, error: 'A reason is required to dispute an invoice' };
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const inv = await prisma.poInvoice.findFirst({
    where: { id: parsed.data.invoiceId, workspaceId: workspace.id },
    select: { id: true, poId: true, status: true },
  });
  if (!inv) return { ok: false, error: 'Invoice not found' };
  if (inv.status === 'PAID' || inv.status === 'VOID') {
    return { ok: false, error: `Cannot dispute an invoice in ${inv.status} state` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.poInvoice.update({
      where: { id: inv.id },
      data: { status: 'DISPUTED', disputedAt: new Date(), disputedReason: parsed.data.reason },
    });
    await tx.poEvent.create({
      data: {
        workspaceId: workspace.id,
        poId: inv.poId,
        type: 'INVOICE_DISPUTED',
        actor: userId,
        meta: { invoiceId: inv.id, reason: parsed.data.reason },
      },
    });
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos/${inv.poId}`);
  return { ok: true };
}

const markPaidSchema = z.object({
  workspaceSlug: z.string().min(1),
  invoiceId: z.string().min(1),
  paidMethod: z.enum(['ACH', 'CARD', 'CHECK', 'WIRE']),
  paidReference: z.string().min(1, 'Reference # required').max(120),
});

export async function markInvoicePaidAction(
  input: z.infer<typeof markPaidSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Reference number and payment method are required' };
  }
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  // AP-only action — owner/admin only. PMs don't mark paid.
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Only owners/admins can mark invoices paid' };
  }
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const inv = await prisma.poInvoice.findFirst({
    where: { id: parsed.data.invoiceId, workspaceId: workspace.id },
    select: { id: true, poId: true, status: true },
  });
  if (!inv) return { ok: false, error: 'Invoice not found' };
  if (inv.status === 'PAID' || inv.status === 'VOID') {
    return { ok: false, error: `Cannot mark a ${inv.status} invoice as paid` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.poInvoice.update({
      where: { id: inv.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidMethod: parsed.data.paidMethod,
        paidReference: parsed.data.paidReference,
        paidById: userId,
      },
    });
    await tx.poEvent.create({
      data: {
        workspaceId: workspace.id,
        poId: inv.poId,
        type: 'PAYMENT_SENT',
        actor: userId,
        meta: {
          invoiceId: inv.id,
          method: parsed.data.paidMethod,
          reference: parsed.data.paidReference,
        },
      },
    });
    // Don't auto-transition the PO to RECEIVED/CLOSED —
    // that's a separate decision (goods received is a
    // separate event from invoice paid). The user can
    // click "Mark received" on the PO when applicable.
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/procurement/pos/${inv.poId}`);
  return { ok: true };
}
