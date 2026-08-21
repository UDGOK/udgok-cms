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
      deletedAt: null,
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
    data: { revokedAt: new Date(), status: 'REVOKED' },
  });
  if (r.count === 0) return { ok: false, error: 'RFQ not found or already revoked' };
  await recordRfqEvent({ id: rfqId, workspaceId }, 'REVOKED', { actor: userId });

  revalidatePath(`/w/_/procurement/rfqs/${rfqId}`);
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────
//  RFQ edit / revise / resend / delete / extend
// ───────────────────────────────────────────────────────────────────
//
//  Two distinct "edit" semantics:
//   - DRAFT: just edit the row in place (the vendor has never
//     seen it, no audit drift).
//   - SENT/VIEWED: either edit silently (no notify) or revise +
//     resend (new Rfq row, new token, new email). Silent edit
//     is implemented by updateRfqAction too; the caller's
//     intent is encoded in the `notify` boolean.
//
//  Revise + resend (reviseRfqAction) is the more interesting
//  case: the buyer says "I want to change the line items and
//  send a new copy to the vendor". The old Rfq becomes a
//  SUPERSEDED tombstone; a new Rfq row is created with
//  parentRfqId pointing back. The vendor's old link is dead
//  and routes to the "revised" notice. The new link is in
//  the fresh email.
// ───────────────────────────────────────────────────────────────────

const editRfqSchema = z.object({
  rfqId: z.string().min(1),
  contactId: z.string().min(1).nullable().optional(),
  message: z.string().max(4000).nullable().optional(),
  neededBy: z.coerce.date().nullable().optional(),
  ttlDays: z.coerce.number().int().min(1).max(MAX_TTL_DAYS).optional(),
  // 'silent' (default for DRAFT) or 'notify' (re-emails the
  // vendor — used when buyer edits a SENT RFQ and wants the
  // rep to see the new version). For DRAFT, 'notify' is a
  // no-op (no email is sent until the first send).
  notify: z.boolean().optional(),
});

/**
 * Edit a DRAFT or SENT/VIEWED RFQ.
 *
 * - DRAFT: in-place update. No email. The buyer can keep
 *   editing until they hit "Send".
 * - SENT/VIEWED + notify:false (default for SENT): in-place
 *   update. The vendor still sees the old version on their
 *   link (we don't push). Useful for small fixes (typo in
 *   message, wrong needed-by). Document the change in the
 *   event log so the audit trail shows the discrepancy.
 * - SENT/VIEWED + notify:true: in-place update AND re-emails
 *   the vendor with the same magic link (no new revision).
 *   Use for "fix and ping" — small change, vendor should
 *   re-look. Token is NOT rotated; same URL is mailed again.
 */
export async function updateRfqAction(
  workspaceId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const raw = formData.get('payload');
  if (typeof raw !== 'string') return { ok: false, error: 'Missing payload' };
  let parsed: z.infer<typeof editRfqSchema>;
  try {
    parsed = editRfqSchema.parse(JSON.parse(raw));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid payload' };
  }

  const rfq = await prisma.rfq.findFirst({
    where: { id: parsed.rfqId, workspaceId, deletedAt: null },
    include: {
      contact: { select: { email: true, name: true } },
      vendor: { select: { name: true } },
      list: { select: { id: true, neededBy: true, name: true, lines: { select: { id: true } } } },
    },
  });
  if (!rfq) return { ok: false, error: 'RFQ not found' };
  // Closed RFQs are immutable. Once the rep responded or
  // the buyer accepted, the audit trail is locked.
  if (
    rfq.status === 'ACCEPTED' ||
    rfq.status === 'DECLINED' ||
    rfq.status === 'EXPIRED' ||
    rfq.status === 'CANCELLED' ||
    rfq.status === 'SUPERSEDED' ||
    rfq.status === 'REVOKED'
  ) {
    return { ok: false, error: `RFQ is ${rfq.status} and can no longer be edited` };
  }

  // Validate contact if changed. Tenant-scope the contact.
  let contactId = parsed.contactId ?? rfq.contactId;
  if (parsed.contactId && parsed.contactId !== rfq.contactId) {
    const contact = await prisma.vendorContact.findFirst({
      where: { id: parsed.contactId, vendorId: rfq.vendorId },
      select: { id: true, email: true },
    });
    if (!contact) return { ok: false, error: 'Contact not found on this vendor' };
    if (!contact.email) return { ok: false, error: 'Selected contact has no email' };
    contactId = contact.id;
  }

  await prisma.rfq.update({
    where: { id: rfq.id },
    data: {
      contactId,
      message: parsed.message !== undefined ? parsed.message : rfq.message,
      neededBy: parsed.neededBy !== undefined ? parsed.neededBy : rfq.neededBy,
    },
  });

  // Build a diff of what changed for the audit log.
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (parsed.message !== undefined && parsed.message !== rfq.message) {
    changes.message = { from: rfq.message, to: parsed.message };
  }
  if (parsed.neededBy !== undefined && String(parsed.neededBy) !== String(rfq.neededBy)) {
    changes.neededBy = { from: rfq.neededBy, to: parsed.neededBy };
  }
  if (parsed.contactId && parsed.contactId !== rfq.contactId) {
    changes.contactId = { from: rfq.contactId, to: parsed.contactId };
  }

  if (Object.keys(changes).length > 0) {
    await recordRfqEvent(rfq, 'EDITED', { actor: userId, meta: { changes, silent: !parsed.notify } });
  }

  // Optional notify: re-email with the existing token (no rotation).
  // Only allowed if we have a contact email AND the RFQ is
  // past DRAFT (otherwise send is its own action).
  let emailed = false;
  if (parsed.notify && rfq.status !== 'DRAFT' && rfq.contact?.email) {
    // We can't recover the plaintext token from the hash.
    // The original token was emailed; the buyer's RFQ detail
    // page already shows the magic link after the initial
    // send. We rotate the token here (safer — old link in any
    // previous inbox is dead) and email the new one.
    const { token, tokenHash, tokenPrefix } = generateRfqToken();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';
    const url = `${baseUrl}/q/${token}`;
    const expiresAt = new Date(Date.now() + (parsed.ttlDays ?? DEFAULT_TTL_DAYS) * 864e5);
    await prisma.rfq.update({
      where: { id: rfq.id },
      data: { tokenHash, tokenPrefix, expiresAt, sentToEmail: rfq.contact.email },
    });
    const send = await sendRfqEmail({
      to: rfq.contact.email,
      replyTo: 'purchasing@udgok.com',
      rfqNumber: rfq.number,
      vendorName: rfq.vendor.name,
      ourCompanyName: process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction',
      lineCount: rfq.list.lines.length,
      neededBy: parsed.neededBy ?? rfq.neededBy ?? rfq.list.neededBy,
      message: parsed.message !== undefined ? parsed.message : rfq.message,
      url,
      expiresAt,
    });
    emailed = send.sent;
    if (send.sent) {
      await recordRfqEvent(rfq, 'RESENT', { actor: userId, meta: { reason: 'edit-notify' } });
    }
  }

  revalidatePath(`/w/_/procurement/rfqs/${rfq.id}`);
  return {
    ok: true,
    // Surface a soft message that names what happened. Useful
    // for the UI to show "Saved (no email sent)" vs "Saved
    // and re-sent to vendor".
    message: parsed.notify
      ? emailed
        ? 'Saved and email re-sent to vendor'
        : 'Saved but email could not be sent'
      : Object.keys(changes).length === 0
      ? 'No changes'
      : `Saved (${Object.keys(changes).length} field${Object.keys(changes).length === 1 ? '' : 's'} updated)`,
  };
}

/**
 * Revise + resend. Creates a new Rfq row with parentRfqId
 * pointing back, marks the old one SUPERSEDED, rotates
 * tokens, sends a fresh email to the vendor. The vendor's
 * old link now routes to a "revised" notice (not a 410).
 *
 * The "message" field, "neededBy" date, and "contactId" can
 * be overridden; if not provided, the new revision inherits
 * from the parent (the buyer is just bumping the version
 * with a fresh send).
 */
export async function reviseRfqAction(
  workspaceId: string,
  rfqId: string,
  overrides?: {
    message?: string | null;
    neededBy?: Date | null;
    contactId?: string;
  },
): Promise<ActionResult<{ newRfqId: string; magicLinkUrl: string | null; sent: boolean; message: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const parent = await prisma.rfq.findFirst({
    where: { id: rfqId, workspaceId, deletedAt: null },
    include: {
      vendor: { select: { name: true, id: true } },
      list: { select: { id: true, neededBy: true, name: true, lines: { select: { id: true } } } },
      contact: { select: { id: true, name: true, email: true } },
      childRfqs: { where: { deletedAt: null }, orderBy: { revision: 'desc' }, take: 1, select: { revision: true } },
    },
  });
  if (!parent) return { ok: false, error: 'RFQ not found' };
  if (
    parent.status === 'ACCEPTED' ||
    parent.status === 'DECLINED' ||
    parent.status === 'EXPIRED' ||
    parent.status === 'CANCELLED' ||
    parent.status === 'SUPERSEDED' ||
    parent.status === 'REVOKED'
  ) {
    return { ok: false, error: `RFQ is ${parent.status} and cannot be revised` };
  }

  // Validate override contact (if any).
  let contactId = parent.contactId;
  let contactEmail = parent.contact?.email ?? null;
  if (overrides?.contactId && overrides.contactId !== parent.contactId) {
    const c = await prisma.vendorContact.findFirst({
      where: { id: overrides.contactId, vendorId: parent.vendorId },
      select: { id: true, email: true },
    });
    if (!c) return { ok: false, error: 'Contact not found on this vendor' };
    if (!c.email) return { ok: false, error: 'Selected contact has no email' };
    contactId = c.id;
    contactEmail = c.email;
  }
  if (!contactEmail) return { ok: false, error: 'No contact email on this RFQ' };

  // Determine the next revision number. parent + max(child).
  const nextRevision = Math.max(parent.revision, ...parent.childRfqs.map((c) => c.revision)) + 1;

  // Generate the new token OUTSIDE the transaction (so the
  // plaintext is available for the email send).
  const { token, tokenHash, tokenPrefix } = generateRfqToken();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 864e5);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';
  const url = `${baseUrl}/q/${token}`;

  // Atomic: flip parent to SUPERSEDED, create child, log events.
  //
  // The child Rfq's number MUST be unique in the workspace
  // (Rfq has @@unique([workspaceId, number])). We append
  // "-R{revision}" for rev > 1 so the displayed number is
  // still human-readable ("RFQ-2026-0001 rev 2") and the row
  // satisfies the constraint. The detail view hides the
  // suffix and renders "rev N" as a separate label.
  const childNumber = nextRevision > 1
    ? `${parent.number}-R${nextRevision}`
    : parent.number;

  let newRfqId: string;
  try {
    newRfqId = await prisma.$transaction(async (tx) => {
    const child = await tx.rfq.create({
      data: {
        workspaceId,
        listId: parent.listId,
        vendorId: parent.vendorId,
        contactId,
        sentToEmail: contactEmail,
        number: childNumber,
        tokenHash,
        tokenPrefix,
        expiresAt,
        message: overrides?.message !== undefined ? overrides.message : parent.message,
        neededBy: overrides?.neededBy !== undefined ? overrides.neededBy : parent.neededBy,
        status: 'DRAFT', // moves to SENT after email lands
        createdBy: userId,
        parentRfqId: parent.id,
        revision: nextRevision,
      },
      select: { id: true, number: true, revision: true },
    });
    // Flip the parent to SUPERSEDED. We do NOT clear its
    // token — that row's token is the credential on the
    // vendor's old link, which now routes to the
    // "revised" notice instead of a 410.
    await tx.rfq.update({
      where: { id: parent.id },
      data: { status: 'SUPERSEDED' },
    });
    await tx.rfqEvent.create({
      data: {
        workspaceId,
        rfqId: parent.id,
        type: 'SUPERSEDED',
        actor: userId,
        meta: { successorRfqId: child.id, revision: nextRevision },
      },
    });
    await tx.rfqEvent.create({
      data: {
        workspaceId,
        rfqId: child.id,
        type: 'CREATED',
        actor: userId,
        meta: { source: 'REVISE', parentRfqId: parent.id, revision: nextRevision },
      },
    });
    return child.id;
    });
  } catch (e) {
    // Translate Prisma's unique-constraint error to a
    // user-friendly message. The most likely cause is a
    // stale (workspaceId, number) collision — defensive
    // re-numbering as `-R{nextRevision}` is supposed to
    // prevent this, but a prior failed run may have left
    // a row with the same suffix.
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('Unique constraint') && msg.includes('number')) {
      return {
        ok: false,
        error: `A revision with that number already exists. Please refresh and try again. (${msg})`,
      };
    }
    return { ok: false, error: `Revise failed: ${msg}` };
  }

  // Send the email. Same shape as createRfqAction, just
  // stamping "rev N" in the subject.
  const send = await sendRfqEmail({
    to: contactEmail,
    replyTo: 'purchasing@udgok.com',
    rfqNumber: `${parent.number} (rev ${nextRevision})`,
    vendorName: parent.vendor.name,
    ourCompanyName: process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction',
    lineCount: parent.list.lines.length,
    neededBy: overrides?.neededBy !== undefined ? overrides.neededBy : parent.neededBy,
    message: overrides?.message !== undefined ? overrides.message : parent.message,
    url,
    expiresAt,
  });

  if (send.sent) {
    await prisma.rfq.update({
      where: { id: newRfqId },
      data: { status: 'SENT', sentAt: new Date() },
    });
    await recordRfqEvent({ id: newRfqId, workspaceId }, 'SENT', {
      actor: userId,
      meta: { resendId: send.resendId, revision: nextRevision },
    });
  }

  revalidatePath(`/w/_/procurement/rfqs/${parent.id}`);
  revalidatePath(`/w/_/procurement/rfqs/${newRfqId}`);

  return {
    ok: true,
    newRfqId,
    magicLinkUrl: send.sent ? null : url,
    sent: send.sent,
    message: send.sent
      ? `Rev ${nextRevision} email sent to ${contactEmail}`
      : `Rev ${nextRevision} saved. Email not sent: ${send.message}`,
  };
}

/**
 * Extend the deadline. Pushes expiresAt out by N days,
 * sends a one-line "deadline extended" email to the vendor.
 * Does NOT create a new revision (content is unchanged).
 *
 * If you want to change the line items, use reviseRfqAction
 * instead — that's a different verb.
 */
export async function extendRfqDeadlineAction(
  workspaceId: string,
  rfqId: string,
  days: number,
): Promise<ActionResult<{ newExpiresAt: Date }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    await assertRole(workspaceId, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }
  if (!Number.isFinite(days) || days < 1 || days > 90) {
    return { ok: false, error: 'Days must be between 1 and 90' };
  }

  const rfq = await prisma.rfq.findFirst({
    where: { id: rfqId, workspaceId, deletedAt: null },
    include: {
      contact: { select: { email: true, name: true } },
      vendor: { select: { name: true } },
    },
  });
  if (!rfq) return { ok: false, error: 'RFQ not found' };
  if (
    rfq.status === 'ACCEPTED' ||
    rfq.status === 'DECLINED' ||
    rfq.status === 'EXPIRED' ||
    rfq.status === 'CANCELLED' ||
    rfq.status === 'SUPERSEDED' ||
    rfq.status === 'REVOKED'
  ) {
    return { ok: false, error: `RFQ is ${rfq.status} and deadline cannot be extended` };
  }

  const newExpiresAt = new Date(
    Math.max(rfq.expiresAt.getTime(), Date.now()) + days * 864e5,
  );

  await prisma.rfq.update({
    where: { id: rfq.id },
    data: { expiresAt: newExpiresAt },
  });
  await recordRfqEvent(rfq, 'EXTENDED', {
    actor: userId,
    meta: { previousExpiresAt: rfq.expiresAt.toISOString(), newExpiresAt: newExpiresAt.toISOString(), days },
  });

  // One-line notify email. We could call sendRfqEmail with
  // a "this is an extension, not a new request" body, but
  // a dedicated small email is cleaner. For now, log + alert
  // in the UI; full email can be a follow-up. The buyer
  // already has the link; they can forward it.
  if (rfq.contact?.email) {
    // Reuse the regular RFQ email — vendor will see the
    // same form with the new deadline baked in. Same token,
    // same URL, just a longer validity window.
    // We can't recover the plaintext token, so we rotate
    // it (safer) and re-mail the link with the new
    // expiresAt in the email body.
    const { token, tokenHash, tokenPrefix } = generateRfqToken();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';
    const url = `${baseUrl}/q/${token}`;
    await prisma.rfq.update({
      where: { id: rfq.id },
      data: { tokenHash, tokenPrefix },
    });
    const send = await sendRfqEmail({
      to: rfq.contact.email,
      replyTo: 'purchasing@udgok.com',
      rfqNumber: rfq.number,
      vendorName: rfq.vendor.name,
      ourCompanyName: process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction',
      lineCount: 0, // not used in the body, but required
      neededBy: rfq.neededBy,
      message: rfq.message ? `${rfq.message}\n\n(Deadline extended by ${days} day${days === 1 ? '' : 's'})` : `Deadline extended by ${days} day${days === 1 ? '' : 's'}.`,
      url,
      expiresAt: newExpiresAt,
    });
    if (send.sent) {
      await recordRfqEvent(rfq, 'RESENT', { actor: userId, meta: { reason: 'extend-deadline' } });
    }
  }

  revalidatePath(`/w/_/procurement/rfqs/${rfq.id}`);
  return { ok: true, newExpiresAt };
}

/**
 * Soft-delete a DRAFT RFQ. SENT+ RFQs must be revoked, not
 * deleted, so the audit trail stays intact. Soft delete
 * sets deletedAt; all reads filter it out.
 *
 * If the buyer later wants to remove the row entirely, a
 * nightly job (or admin) can hard-delete rows where
 * deletedAt < now() - 90 days AND status = DRAFT.
 */
export async function softDeleteRfqAction(
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
    where: { id: rfqId, workspaceId, status: 'DRAFT', deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (r.count === 0) {
    return {
      ok: false,
      error: 'Only DRAFT RFQs can be deleted. Use Revoke for sent RFQs.',
    };
  }
  await recordRfqEvent({ id: rfqId, workspaceId }, 'DELETED', { actor: userId });

  revalidatePath(`/w/_/procurement/rfqs/${rfqId}`);
  revalidatePath(`/w/_/procurement`);
  return { ok: true };
}
