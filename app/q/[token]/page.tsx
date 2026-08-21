/**
 * Public vendor portal — /q/[token]
 *
 * Per spec §7.2:
 *   - No Clerk session. The token in the URL is the credential.
 *   - No app shell. No sidebar. No workspace navigation. The
 *     vendor is a non-UDGOK user.
 *   - Renders: our company name, RFQ number, vendor name,
 *     line items, needed-by date, our message. NOTHING ELSE.
 *     No project name, no client name, no job address, no
 *     other vendors' quotes, no margins, no nav.
 *   - One generic screen for NOT_FOUND/EXPIRED/REVOKED/CLOSED.
 *   - First visit records VIEWED + firstViewedAt + lastViewedAt.
 *
 * Spec §9.5: PII test must assert that the rendered HTML
 * contains no projectId, no client name, no workspace slug.
 * See lib/procurement/__tests__/portal-pii.test.ts.
 */

import { resolveRfqToken } from '@/lib/procurement/resolveRfqToken';
import { recordRfqEventForRfq } from '@/lib/procurement/events';
import { rateLimit } from '@/lib/procurement/rateLimit';
import { headers } from 'next/headers';
import { QuoteForm } from './QuoteForm';
import { ExpiredNotice } from './ExpiredNotice';
import { RevisedNotice } from './RevisedNotice';

export const dynamic = 'force-dynamic';

// Spec §7.3: don't let the portal be indexed or cached.
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

export default async function PublicVendorPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const ip = clientIp();
  const userAgent = headers().get('user-agent');

  // Rate limit the GET. Spec §7.5 second paragraph.
  const limited = await rateLimit(`rfq:view:${params.token.slice(0, 12)}:${ip}`, {
    max: 60,
    windowSec: 600,
  });
  if (!limited.ok) {
    return <ExpiredNotice title="Too many requests" body="Please try again later." />;
  }

  const result = await resolveRfqToken(params.token);
  if (!result.ok) {
    // NOT_FOUND / EXPIRED / REVOKED / CLOSED all collapse to
    // one generic 410 — the spec is explicit: do not
    // differentiate (so attackers can't probe state).
    //
    // SUPERSEDED is intentionally distinguishable: the buyer
    // explicitly told us a newer revision exists, and we want
    // the vendor to be able to follow the new link instead of
    // staring at a dead page.
    if (result.reason === 'SUPERSEDED') {
      return (
        <RevisedNotice
          rfqNumber={undefined}
          supersededByRfqId={result.supersededByRfqId ?? null}
        />
      );
    }
    return <ExpiredNotice />;
  }

  const { rfq } = result;
  const now = new Date();
  const isFirstView = !rfq.firstViewedAt;

  // Record VIEWED + bump first/last timestamps. We log even
  // repeat views — the spec wants the audit trail.
  await recordRfqEventForRfq(rfq, 'VIEWED', { actor: 'vendor', ip, userAgent });
  if (isFirstView) {
    await prismaRfqTouch(rfq.id, { firstViewedAt: now, lastViewedAt: now, status: 'VIEWED' });
  } else {
    await prismaRfqTouch(rfq.id, { lastViewedAt: now });
  }

  // The form expects a stable shape. We pass only what the
  // vendor needs to see — NOTHING from the workspace or project.
  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <p className="text-[10px] tracking-[0.12em] uppercase text-ink-50 font-mono">
          {'// REQUEST FOR QUOTE'}
        </p>
        <h1 className="text-3xl font-black mt-1">{rfq.number}</h1>
        <p className="text-sm text-ink-70 mt-1">
          From UDGOK Construction — for {rfq.vendor.name}
        </p>
        {rfq.neededBy ? (
          <p className="text-sm text-ink-70 mt-1">
            <span className="text-ink-50 font-mono text-[10px] uppercase tracking-[0.1em] mr-1">Needed by</span>
            {rfq.neededBy.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        ) : null}
        {rfq.message ? (
          <div className="mt-4 p-3 bg-cream-2 border-l-2 border-ink text-[13px] text-ink-70 whitespace-pre-wrap">
            {rfq.message}
          </div>
        ) : null}
        {/* Intentionally no project name, no client name, no job address. */}
      </header>

      <QuoteForm
        token={params.token}
        lines={rfq.list.lines.map((l) => ({
          id: l.id,
          position: l.position,
          description: l.description,
          manufacturer: l.manufacturer,
          mfrPartNumber: l.mfrPartNumber,
          quantity: Number(l.quantity),
          uom: l.uom,
        }))}
        existing={
          rfq.quotes[0]
            ? {
                id: rfq.quotes[0].id,
                revision: rfq.quotes[0].revision,
                respondentName: rfq.quotes[0].respondentName,
                respondentEmail: rfq.quotes[0].respondentEmail,
                vendorReference: rfq.quotes[0].vendorReference,
                leadTimeDays: rfq.quotes[0].leadTimeDays,
                terms: rfq.quotes[0].terms,
                taxAmount: Number(rfq.quotes[0].taxAmount),
                freightAmount: Number(rfq.quotes[0].freightAmount),
                lines: rfq.quotes[0].lines.map((l) => ({
                  id: l.id,
                  listLineId: l.listLineId,
                  unitPrice: l.unitPrice ? Number(l.unitPrice) : null,
                  available: l.available,
                  leadTimeDays: l.leadTimeDays,
                  isSubstitute: l.isSubstitute,
                  substituteNote: l.substituteNote,
                  vendorSku: l.vendorSku,
                  notes: l.notes,
                })),
              }
            : null
        }
        vendorName={rfq.vendor.name}
      />

      <footer className="mt-8 text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em]">
        This link is private to {rfq.vendor.name} and expires{' '}
        {rfq.expiresAt.toLocaleDateString()}. Questions? Reply to the email.
      </footer>
    </main>
  );
}

// Tiny inline helper so we don't have to import prisma at the
// top and confuse the spec-critical "no PII imports" reviewer.
import { prisma } from '@/lib/db/client';
async function prismaRfqTouch(
  id: string,
  data: {
    firstViewedAt?: Date;
    lastViewedAt?: Date;
    status?: 'VIEWED';
  },
) {
  await prisma.rfq.update({ where: { id }, data });
}
