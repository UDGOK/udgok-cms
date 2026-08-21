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
import { generateVendorPortalToken, sha256Token } from './vendor-portal-token';
import { resolvePoPortalUrl } from './portal-url';
import { getWorkspacePaymentSettings } from './payment-settings';
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
        // Pre-fill delivery from the list's deliverTo (if set
        // by the buyer at list-creation time). The PO editor
        // can override before the buyer hits "Issue PO".
        shipTo: rfq.list.deliverTo,
        deliveryAddress: rfq.list.deliverTo,
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

    // PoEvent: CREATED. Mirrors the RFQ CREATED event so
    // the buyer's audit trail shows the moment of creation.
    await tx.poEvent.create({
      data: {
        workspaceId,
        poId: created.id,
        type: 'CREATED',
        actor: userId,
        meta: { source: 'ACCEPT_QUOTE', quoteId: quote.id, rfqId: rfq.id },
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

  // Mint a vendor portal token. The plaintext goes into the
  // PO issue email (and the re-send path); the hash is what
  // we store. We generate BEFORE flipping status so a DB
  // error doesn't leave us with a half-issued PO. Tokens are
  // stable — we don't rotate on re-send.
  let portalPlaintext: string;
  let portalHash: string;
  try {
    const t = generateVendorPortalToken();
    portalPlaintext = t.plaintext;
    portalHash = t.hash;
  } catch {
    return { ok: false, error: 'Could not generate portal token' };
  }

  // Flip status first so the PO is "real" before we do any
  // IO. If email fails, the PO is still issued and the buyer
  // can re-send manually. Reverse order is worse — buyer
  // thinks the PO is sent but it's actually still pending.
  const result = await prisma.purchaseOrder.updateMany({
    where: { id: parsed.data.poId, workspaceId, status: 'PENDING_APPROVAL' },
    data: {
      status: 'ISSUED',
      issuedAt: new Date(),
      issuedBy: userId,
      vendorPortalToken: portalHash,
      vendorPortalTokenIssuedAt: new Date(),
    },
  });
  if (result.count === 0) return { ok: false, error: 'PO not in PENDING_APPROVAL' };

  // PoEvent: ISSUED. Captures who + when for the audit trail.
  await prisma.poEvent.create({
    data: {
      workspaceId,
      poId: parsed.data.poId,
      type: 'ISSUED',
      actor: userId,
    },
  });

  // Try to email the vendor with the PDF. Failure is logged
  // and surfaced to the UI, but does NOT un-issue the PO —
  // the buyer can re-send or download the PDF manually.
  try {
    const sent = await emailPoToVendor(workspaceId, parsed.data.poId, portalPlaintext);
    if (!sent.ok) {
      console.warn('[po-actions] PO email not sent:', sent.reason, sent.message);
    }
  } catch (e) {
    console.error('[po-actions] PO email threw:', e);
  }

  revalidatePath(`/w/_/procurement/pos/${parsed.data.poId}`);
  return { ok: true };
}

/**
 * Internal helper: render the PO PDF and email it to the
 * vendor contact (or RFQ respondent email if no contact).
 * Returns the send result without throwing — the caller
 * decides what to do with a failure.
 */
async function emailPoToVendor(
  workspaceId: string,
  poId: string,
  portalPlaintext: string,
): Promise<{ ok: true } | { ok: false; reason: string; message?: string }> {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, workspaceId },
    include: {
      vendor: { select: { name: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true } },
      quote: {
        select: {
          vendorReference: true,
          respondentName: true,
          respondentEmail: true,
          rfq: { select: { contact: { select: { name: true, email: true, phone: true } } } },
        },
      },
      lines: { orderBy: { position: 'asc' } },
    },
  });
  if (!po) return { ok: false, reason: 'PO_NOT_FOUND' };

  const to = po.quote?.respondentEmail ?? po.quote?.rfq?.contact?.email;
  if (!to) return { ok: false, reason: 'NO_VENDOR_EMAIL' };

  const ourCompanyName = process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction';
  const ourEmail = process.env.PROCUREMENT_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ?? 'purchasing@udgok.com';
  const ourPhone = process.env.UDGOK_CONTACT_PHONE ?? '';

  // Workspace payment settings — surfaces the invoice email
  // and "send us a payment link" CTA in the PO body.
  const settings = await getWorkspacePaymentSettings(workspaceId);
  const portalUrl = resolvePoPortalUrl(portalPlaintext);

  const { renderPoPdf } = await import('@/lib/procurement/render-po-pdf');
  const { sendPoEmail } = await import('@/lib/procurement/email');

  const pdf = await renderPoPdf({
    number: po.number,
    status: po.status,
    issuedAt: po.issuedAt,
    createdAt: po.createdAt,
    ourCompany: { name: ourCompanyName, contactEmail: ourEmail, contactPhone: ourPhone },
    vendor: {
      name: po.vendor.name,
      contactName: po.quote?.respondentName ?? po.quote?.rfq?.contact?.name ?? null,
      contactEmail: to,
      contactPhone: po.quote?.rfq?.contact?.phone ?? null,
      addressLine1: po.vendor.addressLine1,
      addressLine2: po.vendor.addressLine2,
      city: po.vendor.city,
      state: po.vendor.state,
      postalCode: po.vendor.postalCode,
    },
    shipTo: po.shipTo,
    neededBy: po.neededBy,
    terms: po.terms,
    vendorReference: po.quote?.vendorReference ?? null,
    subtotal: Number(po.subtotal),
    freightAmount: Number(po.freightAmount),
    taxAmount: Number(po.taxAmount),
    total: Number(po.total),
    notes: po.notes,
    deliveryName: po.deliveryName,
    deliveryAddress: po.deliveryAddress,
    deliveryContactName: po.deliveryContactName,
    deliveryContactPhone: po.deliveryContactPhone,
    deliveryContactEmail: po.deliveryContactEmail,
    lines: po.lines.map((l) => ({
      position: l.position,
      description: l.description,
      quantity: Number(l.quantity),
      uom: l.uom,
      vendorSku: l.vendorSku,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
      isSubstitute: l.isSubstitute,
      substituteNote: l.substituteNote,
    })),
  });

  const res = await sendPoEmail({
    to,
    replyTo: ourEmail,
    poNumber: po.number,
    vendorName: po.vendor.name,
    vendorContactName: po.quote?.respondentName ?? po.quote?.rfq?.contact?.name ?? null,
    ourCompanyName,
    total: Number(po.total),
    neededBy: po.neededBy,
    shipTo: po.shipTo,
    terms: po.terms,
    deliveryName: po.deliveryName,
    deliveryAddress: po.deliveryAddress,
    deliveryContactName: po.deliveryContactName,
    deliveryContactPhone: po.deliveryContactPhone,
    deliveryContactEmail: po.deliveryContactEmail,
    portalUrl,
    invoiceEmail: settings.invoiceEmail,
    pdf,
  });

  if (!res.sent) {
    return { ok: false, reason: res.reason ?? 'UNKNOWN', message: res.message };
  }
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────
//  Re-send PO email — the buyer hits a "Resend" button on the
//  detail page when the issue-time email failed (e.g. vendor's
//  address was wrong, or the email landed in spam).
// ───────────────────────────────────────────────────────────────────

/**
 * Re-send a PO email to the vendor. Allowed for any ISSUED
 * PO (or later status). Same gate as issue — OWNER | ADMIN
 * | PM.
 *
 * Returns the same shape as issuePoAction: ok: true on
 * success, ok: false with a reason on failure (so the UI
 * can show "Email not delivered: NO_VENDOR_EMAIL" etc.).
 */
export async function resendPoEmailAction(
  workspaceId: string,
  poId: string,
): Promise<ActionResult<{ resendId?: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  // Verify the PO exists in this workspace and is issued (or
  // further along). The buyer shouldn't be able to resend
  // an email for a DRAFT that was never sent.
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, workspaceId },
    select: { id: true, status: true },
  });
  if (!po) return { ok: false, error: 'PO not found' };
  if (po.status === 'DRAFT' || po.status === 'CANCELLED' || po.status === 'PENDING_APPROVAL') {
    return { ok: false, error: `Cannot resend for a ${po.status} PO. Issue it first.` };
  }

  // Re-mint the portal token. The previous link is
  // invalidated — vendor must use the new link in this
  // email. Plaintext lives in this scope only; the DB
  // stores the hash.
  let portalPlaintext: string;
  try {
    portalPlaintext = generateVendorPortalToken().plaintext;
  } catch {
    return { ok: false, error: 'Could not generate portal token' };
  }
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      vendorPortalToken: sha256Token(portalPlaintext),
      vendorPortalTokenIssuedAt: new Date(),
    },
  });

  try {
    const sent = await emailPoToVendor(workspaceId, poId, portalPlaintext);
    if (!sent.ok) {
      return { ok: false, error: sent.reason, ...(sent.message ? { message: sent.message } : {}) };
    }
  } catch (e) {
    console.error('[resendPoEmailAction] threw:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }

  // PoEvent: RESENT. Records who triggered the resend and
  // when — important for audit because the buyer might
  // resend multiple times (typo'd address, then fix and
  // resend, etc.).
  await prisma.poEvent.create({
    data: {
      workspaceId,
      poId,
      type: 'RESENT',
      actor: userId,
    },
  });

  revalidatePath(`/w/_/procurement/pos/${poId}`);
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
