/**
 * Single CO detail page. Shows the full CO, history, share
 * link to send to the owner/architect, and the AIA G701
 * line items in a printable layout.
 */

import { notFound } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { getChangeOrder } from '@/lib/change-orders/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { fmtDate, fmtDateTimeUtc } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-30 text-ink',
  SUBMITTED: 'bg-warning text-ink',
  UNDER_REVIEW: 'bg-warning text-ink',
  PARTIALLY_APPROVED: 'bg-warning text-ink',
  REVISED: 'bg-ink-30 text-ink',
  APPROVED: 'bg-success text-paper',
  INCLUDED_IN_PAY_APP: 'bg-success text-paper',
  REJECTED: 'bg-error text-paper',
  WITHDRAWN: 'bg-ink-30 text-ink',
  SUPERSEDED: 'bg-ink-30 text-ink',
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
// fmtDate / fmtDateTimeUtc are imported from @/lib/format/currency
// (timezone-deterministic — see lib/format/currency.ts). The local
// fmtDate helper was removed to fix React hydration mismatches: the
// old toLocaleDateString defaulted to the system timezone, which
// differs between server (UTC) and client (user local).

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: { workspace: string; id: string; coId: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const co = await getChangeOrder(params.coId, workspace.id);
  if (!co || co.id !== params.coId) notFound();

  // We need shareToken for the public link, but the query doesn't
  // return it for security. Fetch it explicitly.
  const { prisma } = await import('@/lib/db/client');
  const coWithToken = await prisma.changeOrder.findUnique({
    where: { id: co.id },
    select: { shareToken: true },
  });
  const shareUrl = coWithToken?.shareToken
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com'}/co/${coWithToken.shareToken}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Change Order ${co.number}${co.revision > 1 ? ` Rev ${co.revision}` : ''}`}
        subtitle={co.title}
        breadcrumbs={[
          { label: 'Change orders', href: `/w/${params.workspace}/projects/${params.id}/change-orders` },
          { label: co.number },
        ]}
      />
      <MobilePageHeader title={co.number} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-paper border-2 border-line p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase font-mono px-2 py-1 ${STATUS_COLOR[co.status] ?? 'bg-ink-30 text-ink'}`}>
              {co.status.replace('_', ' ')}
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-1 border-2 border-line">
              {co.type.replace('_', ' ')}
            </span>
            {co.reasonCode ? (
              <span className="text-[10px] uppercase font-mono px-2 py-1 border-2 border-line">
                {co.reasonCode.replace('_', ' ')}
              </span>
            ) : null}
          </div>

          {co.description ? (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-1">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{co.description}</p>
            </div>
          ) : null}

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">AIA G701 line items</h3>
            <table className="w-full text-sm border-t border-line">
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-1.5 font-mono text-ink-70 w-8">1.</td>
                  <td className="py-1.5">Original contract sum</td>
                  <td className="py-1.5 text-right tabular-nums font-mono">{fmtUsd(co.originalContractSum)}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-1.5 font-mono text-ink-70 w-8">2.</td>
                  <td className="py-1.5">Net prior approved change orders</td>
                  <td className="py-1.5 text-right tabular-nums font-mono">{fmtUsd(co.netPriorCOs)}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-1.5 font-mono text-ink-70 w-8">3.</td>
                  <td className="py-1.5 font-semibold">Contract sum prior to this CO</td>
                  <td className="py-1.5 text-right tabular-nums font-mono font-semibold">{fmtUsd(co.priorContractSum)}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-1.5 font-mono text-ink-70 w-8">4.</td>
                  <td className="py-1.5">This change order</td>
                  <td className="py-1.5 text-right tabular-nums font-mono">
                    {co.thisCOAmount >= 0 ? '+' : ''}{fmtUsd(co.thisCOAmount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-mono text-ink-70 w-8">5.</td>
                  <td className="py-1.5 font-bold">New contract sum</td>
                  <td className="py-1.5 text-right tabular-nums font-mono font-bold">{fmtUsd(co.newContractSum)}</td>
                </tr>
              </tbody>
            </table>
            {co.timeImpactDays > 0 ? (
              <p className="text-sm text-ink-70 mt-2">
                <strong>Time impact:</strong> +{co.timeImpactDays} days
                {co.newSubstantialCompletion ? <> · New SC: {fmtDate(co.newSubstantialCompletion)}</> : null}
              </p>
            ) : null}
          </div>

          {co.divisions.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">Division allocation</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase font-mono text-ink-70">
                    <th className="text-left py-1">Division</th>
                    <th className="text-right py-1">This CO</th>
                    <th className="text-right py-1">Budget Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {co.divisions.map((d) => (
                    <tr key={d.id} className="border-t border-line">
                      <td className="py-1.5">
                        <span className="font-mono">{d.projectDivisionCode}</span> {d.projectDivisionTrade}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-mono">{fmtUsd(d.thisCOAmount)}</td>
                      <td className="py-1.5 text-right tabular-nums font-mono">{fmtUsd(d.newBudgetDelta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Signatures */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">Signatures</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex gap-3">
                <dt className="font-mono text-ink-70 w-32">Owner</dt>
                <dd>
                  {co.ownerApprovedAt ? (
                    <>Signed by {co.ownerSignatoryName ?? '—'} on {fmtDate(co.ownerApprovedAt)}</>
                  ) : (
                    <span className="text-ink-60">Awaiting signature</span>
                  )}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="font-mono text-ink-70 w-32">Architect</dt>
                <dd>
                  {co.architectApprovedAt ? (
                    <>Signed by {co.architectSignatoryName ?? '—'} on {fmtDate(co.architectApprovedAt)}</>
                  ) : (
                    <span className="text-ink-60">Awaiting signature</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {co.rejectionReason ? (
            <div className="bg-error/10 border-2 border-error p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-error mb-1">Rejection reason</h3>
              <p className="text-sm">{co.rejectionReason}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {shareUrl ? (
            <div className="bg-paper border-2 border-line p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">
                Share with owner / architect
              </h3>
              <p className="text-xs text-ink-70 mb-2">
                Send this link to the owner and architect. They can sign from any
                device — no login required.
              </p>
              <input
                readOnly
                value={shareUrl}
                className="w-full px-2 py-1 border-2 border-line bg-paper text-xs font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-center px-3 py-1.5 bg-ink text-paper text-xs uppercase tracking-wider font-bold"
              >
                Open public link
              </a>
            </div>
          ) : null}

          <div className="bg-paper border-2 border-line p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">History</h3>
            {co.history.length === 0 ? (
              <p className="text-xs text-ink-60">No activity yet.</p>
            ) : (
              <ol className="space-y-1.5 text-xs">
                {co.history.map((h) => (
                  <li key={h.id} className="border-l-2 border-ink-30 pl-2">
                    <div className="font-semibold">{h.type}</div>
                    <div className="text-ink-60">
                      {h.actor} · {fmtDateTimeUtc(h.createdAt)}
                    </div>
                    {(h.metadata as { details?: string } | null)?.details ? (
                      <div className="text-ink-70 mt-0.5">{(h.metadata as { details?: string }).details}</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
