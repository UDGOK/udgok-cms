/**
 * Public vendor portal — PO response.
 *
 * Mirrors the RFQ portal pattern at /q/[token]: the token
 * in the URL is the credential, no Clerk session. We hash
 * the incoming token, look up the PO, validate state, and
 * hand back the data the form needs.
 *
 * Failure modes (NOT_FOUND / EXPIRED / REVOKED / ALREADY_RESPONDED)
 * all return a generic 410-style page to avoid leaking
 * which one it was.
 */

import { prisma } from '@/lib/db/client';
import { sha256 } from './token';
import { rateLimit } from './rateLimit';
import type {
  PurchaseOrder,
  POLine,
  Vendor,
  VendorContact,
  VendorPaymentMethod,
  Workspace,
  WorkspacePaymentSettings,
} from '@prisma/client';

export type PoPortalFailureReason =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ALREADY_RESPONDED'
  | 'NOT_ISSUED';

export type PoPortalData = PurchaseOrder & {
  vendor: Pick<Vendor, 'id' | 'name' | 'defaultTerms' | 'taxExempt'> & {
    paymentMethods: Pick<
      VendorPaymentMethod,
      | 'id'
      | 'methodType'
      | 'isDefault'
      | 'nickname'
      | 'last4'
      | 'achBankName'
      | 'achRoutingLast4'
      | 'achAccountLast4'
      | 'cardBrand'
    >[];
    // Vendor contacts (we take 1 in the include). The
    // portal pre-fills name/email from contacts[0] if present.
    contacts: Array<Pick<VendorContact, 'id' | 'name' | 'email' | 'phone'>>;
  };
  contact?: Pick<VendorContact, 'id' | 'name' | 'email' | 'phone'> | null;
  lines: POLine[];
  workspace: Pick<Workspace, 'id' | 'name'> & {
    paymentSettings: Pick<
      WorkspacePaymentSettings,
      | 'invoiceEmail'
      | 'invoiceEmailCc'
      | 'defaultTerms'
      | 'paymentLinkBaseUrl'
      | 'achInstructions'
      | 'checkPayableTo'
      | 'checkMailTo'
      | 'allowAch'
      | 'allowCard'
      | 'allowCheck'
      | 'allowPaymentLink'
    > | null;
  };
};

export type PoPortalResult =
  | { ok: true; data: PoPortalData; tokenHash: string }
  | { ok: false; reason: PoPortalFailureReason };

export async function resolvePoPortalToken(
  token: string,
  ip: string,
): Promise<PoPortalResult> {
  // Rate limit by IP — vendor portal shouldn't see brute
  // force attempts. 30 req/min/IP is generous.
  const rl = await rateLimit(`po-portal:${ip}`, { max: 30, windowSec: 60 });
  if (!rl.ok) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  if (!token || token.length < 16 || token.length > 128) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const tokenHash = sha256(token);

  // Cast workaround: Prisma return-type narrowing after
  // schema migration. See CLAUDE.md / agent memory.
  const po = (await prisma.purchaseOrder.findFirst({
    where: { vendorPortalToken: tokenHash },
    include: {
      vendor: {
        include: {
          paymentMethods: {
            where: { isActive: true },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          },
          contacts: {
            where: { id: { not: undefined } },
            orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
            take: 1,
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
      lines: { orderBy: { position: 'asc' } },
      workspace: {
        select: {
          id: true,
          name: true,
          paymentSettings: true,
        },
      },
    },
  })) as unknown as PoPortalData | null;

  if (!po) return { ok: false, reason: 'NOT_FOUND' };
  if (po.status === 'CANCELLED') return { ok: false, reason: 'REVOKED' };
  if (po.status !== 'ISSUED' && po.status !== 'ACKNOWLEDGED') {
    return { ok: false, reason: 'NOT_ISSUED' };
  }
  // 90-day soft expiry. If the PO is older than that and
  // never acknowledged, the vendor can re-request a link.
  if (po.issuedAt) {
    const ageMs = Date.now() - po.issuedAt.getTime();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    if (ageMs > ninetyDays && !po.acknowledgedAt) {
      return { ok: false, reason: 'EXPIRED' };
    }
  }
  return { ok: true, data: po, tokenHash };
}
