/**
 * Public vendor portal — /p/[token]
 *
 * PO acknowledgment portal. Mirrors the RFQ portal at
 * /q/[token] but for issued POs:
 *   - Token in the URL is the credential (no Clerk).
 *   - No app shell, no sidebar, no workspace navigation.
 *   - Renders: PO summary, line items, delivery block,
 *     payment method picker, sign-and-submit form.
 *   - One generic 410 page for NOT_FOUND / EXPIRED /
 *     REVOKED / NOT_ISSUED so we don't leak state.
 *
 * Three possible outcomes from the form:
 *   - ACCEPTED     → PoVendorResponse(responseType=ACCEPTED)
 *                    + PoEvent(VENDOR_RESPONSE_SUBMITTED)
 *                    + PO.acknowledgedAt = now
 *   - COUNTERED    → PoVendorResponse(responseType=COUNTERED)
 *                    + per-line overrides
 *                    + PoEvent
 *                    + PO stays ISSUED, awaits our decision
 *   - REJECTED     → PoVendorResponse(responseType=REJECTED)
 *                    + PoEvent
 *                    + PO.status → CANCELLED
 *
 * The vendor picks a payment method on the same form:
 *   - ON_FILE          (uses VendorPaymentMethod row, if any)
 *   - PAYMENT_LINK     (we email a Stripe checkout link)
 *   - INVOICE_BY_EMAIL (vendor emails invoice to ap@udgok.com)
 *   - CHECK            (we display mailing address)
 *
 * After submit, the form is replaced with a confirmation
 * view that shows the response + payment method chosen.
 */

import { headers } from 'next/headers';
import { resolvePoPortalToken } from '@/lib/procurement/po-vendor-response';
import { rateLimit } from '@/lib/procurement/rateLimit';
import { PoResponseForm } from './PoResponseForm';
import { PoSubmittedView } from './PoSubmittedView';
import { PoPortalExpired } from './PoPortalExpired';

export const dynamic = 'force-dynamic';

// Don't let the portal be indexed or cached by intermediaries.
export const metadata = {
  robots: { index: false, follow: false, nocache: true },
};

function clientIp(): string {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip') ?? 'unknown';
}

export default async function PublicPoPortalPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { submitted?: string };
}) {
  const ip = clientIp();

  // Rate limit by IP — vendor portal shouldn't see brute
  // force attempts. 60 GETs per 10 min per IP.
  const limited = await rateLimit(`po-portal-view:${ip}`, {
    max: 60,
    windowSec: 600,
  });
  if (!limited.ok) {
    return <PoPortalExpired title="Too many requests" body="Please try again later." />;
  }

  const result = await resolvePoPortalToken(params.token, ip);
  if (!result.ok) {
    return <PoPortalExpired />;
  }

  // If the vendor just submitted (we redirect with ?submitted=1
  // on success), show the confirmation view. The vendor can
  // come back to this URL anytime — if the PO has a vendor
  // response, show the "you already submitted" view with
  // their response summary.
  if (searchParams.submitted || result.data.vendorResponseId) {
    return <PoSubmittedView po={result.data} justSubmitted={!!searchParams.submitted} />;
  }

  // Convert Decimal → number for the form (Prisma returns
  // Decimal; the form wants plain numbers for input fields).
  const formPo = {
    ...result.data,
    contact: (result.data as { contact?: unknown }).contact ?? null,
    lines: result.data.lines.map((l) => ({
      id: l.id,
      position: l.position,
      description: l.description,
      vendorSku: l.vendorSku,
      quantity: Number(l.quantity),
      uom: l.uom,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
  };
  return <PoResponseForm po={formPo as never} token={params.token} />;
}
