/**
 * Token → Rfq resolution for the public vendor portal.
 *
 * Per spec §6.3:
 *   - Returns identical generic page for NOT_FOUND, EXPIRED,
 *     REVOKED, CLOSED. Don't tell an attacker which one it was.
 *   - Hash lookup is O(1); enumeration is infeasible.
 *   - Includes the list lines + the most recent submitted quote
 *     so the portal can prefill "edit your previous answer".
 */

import { prisma } from '@/lib/db/client';
import { sha256 } from './token';
import type { Rfq, Vendor, VendorContact, MaterialList, MaterialListLine, Item, VendorQuote, VendorQuoteLine } from '@prisma/client';

export type TokenFailureReason = 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'CLOSED' | 'SUPERSEDED';

export type TokenResult =
  | { ok: true; rfq: RfqWithRelations }
  | { ok: false; reason: TokenFailureReason; supersededByRfqId?: string | null };

// Explicitly-typed include shape. The prisma `include`
// return-type is occasionally narrower than the call claims
// after a schema migration; this is the documented workaround
// (see CLAUDE.md / agent memory "Prisma return type
// narrowing bug after migrations").
export type RfqWithRelations = Rfq & {
  vendor: Pick<Vendor, 'id' | 'name' | 'defaultTerms'>;
  contact: Pick<VendorContact, 'id' | 'name' | 'email'> | null;
  list: MaterialList & {
    lines: (MaterialListLine & {
      item: Pick<Item, 'id' | 'description' | 'sku'> | null;
    })[];
  };
  quotes: (VendorQuote & {
    lines: (VendorQuoteLine & {
      listLine: Pick<MaterialListLine, 'id'> | null;
    })[];
  })[];
};

async function loadRfqByHash(tokenHash: string): Promise<RfqWithRelations | null> {
  const result = await prisma.rfq.findUnique({
    where: { tokenHash },
    include: {
      vendor: { select: { id: true, name: true, defaultTerms: true } },
      contact: { select: { id: true, name: true, email: true } },
      list: {
        select: {
          id: true,
          name: true,
          neededBy: true,
          deliverTo: true,
          notes: true,
          lines: {
            orderBy: { position: 'asc' },
            include: {
              item: { select: { id: true, description: true, sku: true } },
            },
          },
        },
      },
      // Most recent submitted quote, if any. Used to
      // prefill the form so a rep can edit their answer.
      quotes: {
        where: { status: 'SUBMITTED' },
        orderBy: { revision: 'desc' },
        take: 1,
        include: {
          lines: {
            orderBy: { position: 'asc' },
            include: { listLine: { select: { id: true } } },
          },
        },
      },
    },
  });
  return result as RfqWithRelations | null;
}

/** Spec §6.2: the token is the credential, not a session.
 *  Any of NOT_FOUND/EXPIRED/REVOKED/CLOSED collapse to one
 *  generic page (NOT_FOUND) on the public side, so we can't
 *  distinguish them. The caller logs the reason internally.
 *
 *  SUPERSEDED is intentionally distinguishable: the buyer
 *  told us a newer revision exists, and we want the vendor
 *  to be able to follow the new link. Spec §4.5. */
export async function resolveRfqToken(token: string): Promise<TokenResult> {
  // Pre-filter: tokens are 43 chars base64url. Reject anything
  // else before touching the DB to make the error path
  // uninformative and to bound the lookup key space.
  if (!token || token.length < 20 || token.length > 100) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const rfq = await loadRfqByHash(sha256(token));
  if (!rfq) return { ok: false, reason: 'NOT_FOUND' };
  if (rfq.revokedAt) return { ok: false, reason: 'REVOKED' };
  if (rfq.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };
  // Once the buyer has accepted (or the rep has declined),
  // the link is closed. A rep re-opening shouldn't be able
  // to mutate an already-accepted quote.
  if (rfq.status === 'ACCEPTED' || rfq.status === 'CANCELLED' || rfq.status === 'DECLINED') {
    return { ok: false, reason: 'CLOSED' };
  }
  // SUPERSEDED: this RFQ was replaced by a newer revision
  // (revise-and-resend). Find the newest live child so the
  // vendor can be redirected to it.
  if (rfq.status === 'SUPERSEDED') {
    const successor = await prisma.rfq.findFirst({
      where: { parentRfqId: rfq.id, deletedAt: null },
      orderBy: { revision: 'desc' },
      select: { id: true },
    });
    return { ok: false, reason: 'SUPERSEDED', supersededByRfqId: successor?.id ?? null };
  }
  return { ok: true, rfq };
}
