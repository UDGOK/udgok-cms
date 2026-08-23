/**
 * Public Change Order approval portal.
 *
 * Route: /co/[token]
 * Auth:   none — the token IS the credential.
 *
 * Three sections:
 *   1. The CO summary (AIA G701-style line items)
 *   2. Two signature panels — owner + architect
 *   3. The reject form (requires reason)
 *
 * The CO is in SUBMITTED state when this page loads. After both
 * owner and architect sign, the action promotes it to APPROVED
 * and updates the project contract sum in the same transaction.
 */

import { notFound } from 'next/navigation';
import { getChangeOrderByToken, trackChangeOrderView } from '@/lib/change-orders/queries';
import { PublicChangeOrderActions } from './PublicChangeOrderActions';
import { fmtDate } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

export default async function PublicChangeOrderPage({
  params,
}: {
  params: { token: string };
}) {
  const co = await getChangeOrderByToken(params.token);
  if (!co) notFound();

  // Track that the link was opened. Best-effort.
  await trackChangeOrderView(co.id);

  const isFinal = co.status === 'APPROVED';
  const isRejected = co.status === 'REJECTED';
  const ownerSigned = !!co.ownerApprovedAt;
  const architectSigned = !!co.architectApprovedAt;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-60 font-mono">
            {co.workspaceName} — {co.projectName}
          </div>
          <h1 className="text-3xl font-extrabold mt-2">
            Change Order {co.number}
            {co.revision > 1 ? <span className="text-ink-60"> Rev {co.revision}</span> : null}
          </h1>
          <p className="text-ink-70 mt-1">{co.title}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 border-2 border-line">
              {co.type.replace('_', ' ')}
            </span>
            {isFinal ? (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-success text-paper">
                Approved
              </span>
            ) : isRejected ? (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-error text-paper">
                Rejected
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-warning text-ink">
                Awaiting signatures
              </span>
            )}
          </div>
        </div>

        {/* AIA G701 line items */}
        <div className="bg-paper border-2 border-line p-6 mb-6">
          <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em] mb-4">
            Contract sum adjustment
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2 font-mono text-ink-70">1.</td>
                <td className="py-2">Original contract sum</td>
                <td className="py-2 text-right tabular-nums font-mono">
                  {fmtUsd(co.originalContractSum)}
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 font-mono text-ink-70">2.</td>
                <td className="py-2">Net prior approved change orders</td>
                <td className="py-2 text-right tabular-nums font-mono">
                  {fmtUsd(co.netPriorCOs)}
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 font-mono text-ink-70">3.</td>
                <td className="py-2 font-semibold">Contract sum prior to this CO</td>
                <td className="py-2 text-right tabular-nums font-mono font-semibold">
                  {fmtUsd(co.priorContractSum)}
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 font-mono text-ink-70">4.</td>
                <td className="py-2">This change order ({co.type.toLowerCase().replace('_', ' ')})</td>
                <td className="py-2 text-right tabular-nums font-mono">
                  {co.thisCOAmount >= 0 ? '+' : ''}{fmtUsd(co.thisCOAmount)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-ink-70">5.</td>
                <td className="py-2 font-bold">New contract sum</td>
                <td className="py-2 text-right tabular-nums font-mono font-bold">
                  {fmtUsd(co.newContractSum)}
                </td>
              </tr>
            </tbody>
          </table>
          {co.timeImpactDays > 0 ? (
            <div className="mt-4 text-sm text-ink-70">
              <strong>Time impact:</strong> +{co.timeImpactDays} calendar days
              {co.newSubstantialCompletion ? (
                <> · New substantial completion: {fmtDate(co.newSubstantialCompletion)}</>
              ) : null}
            </div>
          ) : null}
          {co.description ? (
            <div className="mt-4 pt-4 border-t border-line">
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-2 text-ink-70">
                Description
              </h3>
              <p className="text-sm whitespace-pre-wrap">{co.description}</p>
            </div>
          ) : null}
        </div>

        {/* Signature panels */}
        {isRejected ? (
          <div className="bg-error/10 border-2 border-error p-5">
            <h2 className="font-bold mb-2">This change order was rejected</h2>
            <p className="text-sm">{co.rejectionReason}</p>
          </div>
        ) : isFinal ? (
          <div className="bg-success/10 border-2 border-success p-5">
            <h2 className="font-bold mb-3">Fully approved</h2>
            <dl className="text-sm space-y-1">
              <div className="flex gap-3">
                <dt className="font-mono text-ink-70 w-32">Owner</dt>
                <dd>
                  {co.ownerApprovedAt
                    ? `Signed ${fmtDate(co.ownerApprovedAt)}`
                    : 'Not signed'}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="font-mono text-ink-70 w-32">Architect</dt>
                <dd>
                  {co.architectApprovedAt
                    ? `Signed ${fmtDate(co.architectApprovedAt)}`
                    : 'Not signed'}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <PublicChangeOrderActions
            token={params.token}
            ownerSigned={ownerSigned}
            architectSigned={architectSigned}
          />
        )}

        <p className="text-[11px] text-ink-60 mt-8 text-center">
          This is a permanent record of the change order. Your typed name
          and timestamp are saved as the signature audit trail.
        </p>
      </div>
    </div>
  );
}
