/**
 * RfqEvent audit log.
 *
 * Every meaningful action on an RFQ writes a row. The vendor
 * portal is the only unauthenticated public surface in the
 * app, so this is what we show the buyer if the vendor later
 * says "we never quoted that" — proof that the link was
 * generated, sent, opened, and submitted, with timestamps
 * and hashed IPs.
 *
 * Per spec §9.6: every access is logged with a *hashed* IP
 * (sha256(APP_HASH_SALT + ip)), never the raw IP.
 */

import { prisma } from '@/lib/db/client';
import { hashIp } from './token';
import type { RfqWithRelations } from './resolveRfqToken';

export type RfqEventType =
  | 'CREATED'
  | 'SENT'
  | 'VIEWED'
  | 'SUBMITTED'
  | 'DECLINED'
  | 'ACCEPTED'
  | 'REVOKED'
  | 'RESENT'
  | 'EXPIRED'
  // New for the CMS-grade RFQ flow (commit
  // revising this conversation). The schema column is
  // still `String` so any string lands, but this list
  // is the source of truth for type-safe callers.
  | 'EDITED'        // DRAFT/SENT edit (with or without notify)
  | 'SUPERSEDED'    // marked dead by a revise-and-resend
  | 'EXTENDED'      // expiresAt pushed out
  | 'DELETED';      // soft-delete (DRAFT only)

export async function recordRfqEvent(
  rfq: { id: string; workspaceId: string },
  type: RfqEventType,
  opts?: {
    actor?: string; // clerk userId, or "vendor"
    ip?: string | null;
    userAgent?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const salt = process.env.APP_HASH_SALT ?? 'no-salt-set';
  const ipHash = opts?.ip ? hashIp(opts.ip, salt) : null;
  await prisma.rfqEvent.create({
    data: {
      workspaceId: rfq.workspaceId,
      rfqId: rfq.id,
      type,
      actor: opts?.actor ?? null,
      ipHash,
      userAgent: opts?.userAgent ? opts.userAgent.slice(0, 300) : null,
      meta: opts?.meta ? (opts.meta as object) : undefined,
    },
  });
}

/** Same but for a typed RfqWithRelations. */
export async function recordRfqEventForRfq(
  rfq: RfqWithRelations,
  type: RfqEventType,
  opts?: {
    actor?: string;
    ip?: string | null;
    userAgent?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  return recordRfqEvent(rfq, type, opts);
}
