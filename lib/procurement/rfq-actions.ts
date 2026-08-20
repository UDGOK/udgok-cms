'use server';

/**
 * RFQ server actions.
 *
 * Per spec §4.5 (RFQ model) and §6.1 (token generation).
 * All actions:
 *   - assert the user is a member of the workspace + allowed role
 *   - tenant-scope every Prisma `where` with workspaceId
 *   - allocate the document number INSIDE the same transaction
 *     as the row create (race-safe per §10.2)
 *   - never log the plaintext token (only the hash)
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { assertRole } from './auth';
import { generateRfqToken } from './token';
import { recordRfqEvent } from './events';
import { sendRfqEmail } from './email';
import { nextDocNumber } from './number';
import type { ActionResult } from './types';

const DEFAULT_TTL_DAYS = 14;
const MAX_TTL_DAYS = 90;

const createRfqSchema = z.object({
  listId: z.string().min(1),
  vendorId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  message: z.string().max(4000).optional(),
  // Ttl is in days. Hard max 90 per spec §6.2.
  ttlDays: z.coerce.number().int().min(1).max(MAX_TTL_DAYS).optional(),
});

export async function createRfqAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<
  ActionResult<{
    id: string;
    number: string;
    // Returned ONLY when send succeeded. The UI then navigates
    // to the RFQ detail page where the buyer can copy the link.
    sent: boolean;
    message: string | null;
    magicLinkUrl: string | null;
  }>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parsed = createRfqSchema.safeParse({
    listId: formData.get('listId'),
    vendorId: formData.get('vendorId'),
    contactId: formData.get('contactId') || undefined,
    message: formData.get('message') || undefined,
    ttlDays: formData.get('ttlDays') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // Tenant scope the list lookup. Cascade the workspaceId
  // through every related fetch.
  const list = await prisma.materialList.findFirst({
    where: { id: parsed.data.listId, workspaceId, deletedAt: null },
    include: { lines: { orderBy: { position: 'asc' } } },
  });
  if (!list) return { ok: false, error: 'Material list not found' };
  if (list.lines.length === 0) {
    return { ok: false, error: 'Add at least one line to the list before sending an RFQ' };
  }
  if (list.status === 'CLOSED') {
    return { ok: false, error: 'This list is closed' };
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: parsed.data.vendorId, workspaceId, deletedAt: null },
    include: { contacts: { orderBy: { createdAt: 'asc' } } },
  });
  if (!vendor) return { ok: false, error: 'Vendor not found' };
  if (vendor.contacts.length === 0) {
    return { ok: false, error: 'Add at least one contact (with email) to this vendor' };
  }

  // Pick the contact. If user didn't pick one, use the
  // primary, else the first.
  const contact = parsed.data.contactId
    ? vendor.contacts.find((c) => c.id === parsed.data.contactId)
    : vendor.contacts.find((c) => c.isPrimary) ?? vendor.contacts[0];
  if (!contact) return { ok: false, error: 'Contact not found' };
  if (!contact.email) {
    return { ok: false, error: 'Selected contact has no email on file' };
  }

  // One RFQ per (vendor, list). If we've already sent one,
  // ask the user to "Resend" instead — that rotates the
  // token and bumps a new SENT event.
  const existing = await prisma.rfq.findFirst({
    where: {
      workspaceId,
      listId: list.id,
      vendorId: vendor.id,
      status: { in: ['DRAFT', 'SENT', 'VIEWED'] },
    },
    select: { id: true, number: true, status: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `An RFQ to ${vendor.name} for this list already exists (${existing.number}, ${existing.status}). Use "Resend" on the RFQ page to rotate the link.`,
    };
  }

  // Generate token OUTSIDE the transaction; the hash
  // write goes inside so the row + number + token land atomically.
  const ttlDays = parsed.data.ttlDays ?? DEFAULT_TTL_DAYS;
  const { token, tokenHash, tokenPrefix } = generateRfqToken();
  const expiresAt = new Date(Date.now() + ttlDays * 864e5);

  const rfq = await prisma.$transaction(async (tx) => {
    const number = await nextDocNumber(tx, workspaceId, 'RFQ');
    return tx.rfq.create({
      data: {
        workspaceId,
        listId: list.id,
        vendorId: vendor.id,
        contactId: contact.id,
        sentToEmail: contact.email,
        number,
        tokenHash,
        tokenPrefix,
        expiresAt,
        message: parsed.data.message || null,
        neededBy: list.neededBy,
        status: 'DRAFT',
        createdBy: userId,
      },
      select: { id: true, number: true },
    });
  });

  await recordRfqEvent({ id: rfq.id, workspaceId }, 'CREATED', { actor: userId });

  // Send the email. We do this AFTER the row lands so a Resend
  // outage doesn't leave us with a "ghost" RFQ that never
  // existed. If send fails we return a non-fatal warning and
  // give the buyer the magic-link URL to copy manually.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';
  const url = `${baseUrl}/q/${token}`;
  const send = await sendRfqEmail({
    to: contact.email,
    replyTo: 'purchasing@udgok.com',
    rfqNumber: rfq.number,
    vendorName: vendor.name,
    ourCompanyName: process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction',
    lineCount: list.lines.length,
    neededBy: list.neededBy,
    message: parsed.data.message ?? null,
    url,
    expiresAt,
  });

  if (send.sent) {
    // Move the RFQ to SENT now that the email is out.
    await prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    await recordRfqEvent({ id: rfq.id, workspaceId }, 'SENT', { actor: userId, meta: { resendId: send.resendId } });
    // Bump the list to QUOTING so it's not sitting in DRAFT.
    if (list.status === 'DRAFT') {
      await prisma.materialList.update({
        where: { id: list.id },
        data: { status: 'QUOTING' },
      });
    }
  }

  revalidatePath(`/w/_/procurement/lists/${list.id}`);
  revalidatePath(`/w/_/procurement/rfqs/${rfq.id}`);

  return {
    ok: true,
    id: rfq.id,
    number: rfq.number,
    sent: send.sent,
    message: send.sent
      ? `Email sent to ${contact.email}`
      : `Saved as DRAFT. Email not sent: ${send.message}`,
    magicLinkUrl: send.sent ? null : url,
  };
}

/** Resend = rotate token + re-send email. Per spec §6.2 rule 6. */
export async function resendRfqAction(
  workspaceId: string,
  rfqId: string,
): Promise<ActionResult<{ magicLinkUrl: string; sent: boolean; message: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const rfq = await prisma.rfq.findFirst({
    where: { id: rfqId, workspaceId },
    include: {
      vendor: { select: { name: true } },
      list: { select: { id: true, neededBy: true, name: true, lines: true } },
      contact: { select: { email: true, name: true } },
    },
  });
  if (!rfq) return { ok: false, error: 'RFQ not found' };
  if (rfq.status === 'ACCEPTED' || rfq.status === 'CANCELLED' || rfq.status === 'DECLINED') {
    return { ok: false, error: `RFQ is ${rfq.status} and cannot be resent` };
  }
  if (!rfq.contact?.email) {
    return { ok: false, error: 'No contact email on file for this RFQ' };
  }

  const { token, tokenHash, tokenPrefix } = generateRfqToken();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';
  const url = `${baseUrl}/q/${token}`;

  // Old token hash is overwritten atomically. Anyone with the
  // old link will now hit a NOT_FOUND (no row matches the old
  // hash). Per spec §6.2 rule 6, never re-mail an old token.
  await prisma.$transaction([
    prisma.rfq.update({
      where: { id: rfq.id },
      data: {
        tokenHash,
        tokenPrefix,
        sentAt: null,
        firstViewedAt: null,
        lastViewedAt: null,
        respondedAt: null,
        revokedAt: null,
        status: 'DRAFT', // will move to SENT below if email lands
        sentToEmail: rfq.contact.email,
        expiresAt: new Date(Date.now() + DEFAULT_TTL_DAYS * 864e5),
      },
    }),
    prisma.rfqEvent.create({
      data: {
        workspaceId,
        rfqId: rfq.id,
        type: 'RESENT',
        actor: userId,
      },
    }),
  ]);

  const send = await sendRfqEmail({
    to: rfq.contact.email,
    replyTo: 'purchasing@udgok.com',
    rfqNumber: rfq.number,
    vendorName: rfq.vendor.name,
    ourCompanyName: process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction',
    lineCount: rfq.list.lines.length,
    neededBy: rfq.list.neededBy,
    message: rfq.message,
    url,
    expiresAt: new Date(Date.now() + DEFAULT_TTL_DAYS * 864e5),
  });

  if (send.sent) {
    await prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    await recordRfqEvent(rfq, 'SENT', { actor: userId, meta: { resend: true } });
  }

  revalidatePath(`/w/_/procurement/rfqs/${rfq.id}`);
  return {
    ok: true,
    magicLinkUrl: send.sent ? url : url,
    sent: send.sent,
    message: send.sent
      ? `Email re-sent to ${rfq.contact.email}`
      : `Rotated link, but email not sent: ${send.message}`,
  };
}

/** Revoke = 410 Gone on the next vendor visit. Per spec §6.2 rule 5. */
export async function revokeRfqAction(
  workspaceId: string,
  rfqId: string,
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const r = await prisma.rfq.updateMany({
    where: { id: rfqId, workspaceId, revokedAt: null },
    data: { revokedAt: new Date(), status: 'CANCELLED' },
  });
  if (r.count === 0) return { ok: false, error: 'RFQ not found or already revoked' };
  await recordRfqEvent({ id: rfqId, workspaceId }, 'REVOKED', { actor: userId });

  revalidatePath(`/w/_/procurement/rfqs/${rfqId}`);
  return { ok: true };
}
