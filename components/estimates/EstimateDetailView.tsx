'use client';

/**
 * EstimateDetailView — the admin builder / detail
 * page. Mirrors the timesheet detail pattern.
 *
 * Sections:
 *   - Header: number + title + status badge + action
 *     bar (Send, Copy link, Convert, Void)
 *   - Metadata grid: client, project, deal, dates
 *   - Public share link (visible after Send)
 *   - Approval audit (when APPROVED/REJECTED/CONVERTED)
 *   - Line items table
 *   - Totals
 *
 * The action bar hides the buttons that don't apply
 * to the current state (e.g., Convert is only shown
 * for APPROVED).
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  sendEstimateAction,
  convertEstimateToProjectAction,
  voidEstimateAction,
} from '@/lib/estimates/actions';
import type { EstimateStatus } from '@prisma/client';

interface LineItem {
  id: string;
  position: number;
  divisionCode: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

interface Estimate {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: EstimateStatus;
  shareToken: string | null;
  validUntil: string | null;
  subtotal: number;
  taxRate: number | null;
  taxAmount: number | null;
  total: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedByEmail: string | null;
  rejectedByName: string | null;
  rejectNote: string | null;
  convertedProjectId: string | null;
  convertedProjectName: string | null;
  convertedAt: string | null;
  pendingProjectName: string | null;
  pendingProjectCode: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null };
  project: { id: string; name: string; code: string | null } | null;
  deal: { id: string; title: string; stage: string } | null;
  lineItems: LineItem[];
}

export function EstimateDetailView({
  workspaceSlug,
  estimate,
  canEdit,
  canConvert,
}: {
  workspaceSlug: string;
  estimate: Estimate;
  canEdit: boolean;
  canConvert: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function run(fn: (slug: string, prev: undefined, fd: FormData) => Promise<{ ok: boolean; error?: string; projectId?: string }>) {
    setError(null);
    const fd = new FormData();
    fd.set('id', estimate.id);
    startTransition(async () => {
      const res = await fn(workspaceSlug, undefined, fd);
      if (res.ok) {
        if (res.projectId) {
          router.push(`/w/${workspaceSlug}/projects/${res.projectId}`);
        } else {
          router.refresh();
        }
      } else {
        setError(res.error ?? 'Action failed');
      }
    });
  }

  function send() {
    run(sendEstimateAction);
  }
  function convert() {
    // Make it clear what project name will be used.
    // The "create new" path uses the pendingProjectName
    // the admin typed on the create form; the "none"
    // path uses the estimate title (legacy default).
    const projectName =
      estimate.pendingProjectName?.trim() ||
      (estimate.project ? estimate.project.name : estimate.title);
    const msg = estimate.project
      ? `Convert this approved estimate to a project? The estimate will close. (No new project is created — this estimate is tied to "${estimate.project.name}".)`
      : `Convert this approved estimate to a new project named "${projectName}"? The estimate will close.`;
    if (!confirm(msg)) return;
    run(convertEstimateToProjectAction);
  }
  function voidEst() {
    if (!confirm('Void this estimate? This closes the estimate permanently.')) return;
    run(voidEstimateAction);
  }

  function copyShareLink() {
    if (!estimate.shareToken) return;
    const url = `${window.location.origin}/e/${estimate.shareToken}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setError('Could not copy to clipboard');
      });
  }

  const isExpired =
    estimate.validUntil && new Date(estimate.validUntil) < new Date() &&
    (estimate.status === 'SENT' || estimate.status === 'VIEWED');

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <div className="mb-3">
        <Link
          href={`/w/${workspaceSlug}/estimates`}
          className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
        >
          ← Back to estimates
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            {estimate.number}
          </div>
          <h1 className="text-2xl font-black mt-0.5">{estimate.title}</h1>
          <div className="text-[12px] text-ink-70 mt-1">
            {estimate.client.name}
            {estimate.project ? ` · ${estimate.project.name}` : ''}
            {!estimate.project && estimate.pendingProjectName ? (
              <span className="text-ink-50"> · Will create “{estimate.pendingProjectName}”</span>
            ) : null}
            {estimate.deal ? ` · Deal: ${estimate.deal.title}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={estimate.status} expired={!!isExpired} />
          {/* Action buttons by state */}
          {canEdit && estimate.status === 'DRAFT' ? (
            <button
              type="button"
              onClick={send}
              disabled={pending}
              className="px-3 py-1.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d disabled:opacity-50"
            >
              {pending ? '…' : 'Send to client'}
            </button>
          ) : null}
          {estimate.shareToken &&
          (estimate.status === 'SENT' ||
            estimate.status === 'VIEWED' ||
            estimate.status === 'APPROVED' ||
            estimate.status === 'REJECTED') ? (
            <button
              type="button"
              onClick={copyShareLink}
              className="px-3 py-1.5 border-2 border-ink text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          ) : null}
          {canConvert && estimate.status === 'APPROVED' ? (
            <button
              type="button"
              onClick={convert}
              disabled={pending}
              className="px-3 py-1.5 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-success hover:bg-success/90 disabled:opacity-50"
            >
              Convert to project
            </button>
          ) : null}
          {canConvert && estimate.status !== 'CONVERTED' && estimate.status !== 'APPROVED' ? (
            <button
              type="button"
              onClick={voidEst}
              disabled={pending}
              className="px-3 py-1.5 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
            >
              Void
            </button>
          ) : null}
        </div>
      </div>

      {/* Share link visible after Send */}
      {estimate.shareToken &&
      (estimate.status === 'SENT' ||
        estimate.status === 'VIEWED' ||
        estimate.status === 'APPROVED' ||
        estimate.status === 'REJECTED') ? (
        <div className="mb-4 bg-cream-2 border-2 border-line p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
            Public link
          </div>
          <code className="text-[12px] font-mono text-ink break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/e/{estimate.shareToken}
          </code>
        </div>
      ) : null}

      {/* Approval audit */}
      {(estimate.approvedAt || estimate.rejectedAt || estimate.convertedAt) ? (
        <div className="mb-4 bg-paper border-2 border-line p-3 text-[12px] space-y-1">
          {estimate.sentAt ? (
            <div className="text-ink-50 font-mono text-[10px] uppercase tracking-[0.12em]">
              Sent {new Date(estimate.sentAt).toLocaleString()}
              {estimate.firstViewedAt ? ` · first viewed ${new Date(estimate.firstViewedAt).toLocaleString()}` : ''}
            </div>
          ) : null}
          {estimate.approvedAt ? (
            <div className="text-success font-extrabold">
              ✓ Approved by {estimate.approvedByName ?? 'client'}
              {estimate.approvedByEmail ? ` (${estimate.approvedByEmail})` : ''}
              {' · '}
              {new Date(estimate.approvedAt).toLocaleString()}
            </div>
          ) : null}
          {estimate.rejectedAt ? (
            <div className="text-error font-extrabold">
              ✗ Rejected by {estimate.rejectedByName ?? 'client'}
              {estimate.rejectedByEmail ? ` (${estimate.rejectedByEmail})` : ''}
              {' · '}
              {new Date(estimate.rejectedAt).toLocaleString()}
              {estimate.rejectNote ? ` — "${estimate.rejectNote}"` : ''}
            </div>
          ) : null}
          {estimate.convertedAt ? (
            <div className="text-orange font-extrabold">
              → Converted to project
              {estimate.convertedProjectName ? `: ${estimate.convertedProjectName}` : ''}
              {' · '}
              {new Date(estimate.convertedAt).toLocaleString()}
              {estimate.convertedProjectId ? (
                <Link
                  href={`/w/${workspaceSlug}/projects/${estimate.convertedProjectId}`}
                  className="ml-2 underline text-ink"
                >
                  Open project
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Description */}
      {estimate.description ? (
        <div className="mb-4 bg-paper border-2 border-line p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
            Description
          </div>
          <div className="text-[12px] text-ink whitespace-pre-wrap">{estimate.description}</div>
        </div>
      ) : null}

      {/* Line items */}
      <div className="mb-4 bg-paper border-2 border-ink overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-cream border-b-2 border-ink">
              <th className="text-left px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-24">
                CSI
              </th>
              <th className="text-left px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
                Description
              </th>
              <th className="text-right px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-20">
                Qty
              </th>
              <th className="text-left px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-16">
                Unit
              </th>
              <th className="text-right px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-28">
                Unit price
              </th>
              <th className="text-right px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-28">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {estimate.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-line last:border-b-0">
                <td className="px-2 py-1.5 font-mono text-ink-50 text-[11px]">
                  {li.divisionCode ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-ink">{li.description}</td>
                <td className="px-2 py-1.5 text-right font-mono text-ink-70">
                  {li.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-1.5 font-mono text-ink-50 text-[11px]">{li.unit}</td>
                <td className="px-2 py-1.5 text-right font-mono text-ink-70">
                  ${li.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-ink font-extrabold">
                  ${li.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-cream">
              <td colSpan={5} className="px-2 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                Subtotal
              </td>
              <td className="px-2 py-2 text-right font-extrabold text-ink">
                ${estimate.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
            {estimate.taxAmount ? (
              <tr className="bg-cream">
                <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                  Tax
                  {estimate.taxRate ? ` (${(estimate.taxRate * 100).toFixed(2)}%)` : ''}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-ink-70">
                  ${estimate.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ) : null}
            <tr className="bg-cream border-t border-line">
              <td colSpan={5} className="px-2 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink font-extrabold">
                Total
              </td>
              <td className="px-2 py-2 text-right font-extrabold text-[16px] text-orange">
                ${estimate.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error ? (
        <div className="text-[11px] text-error font-mono bg-error/10 border border-error px-2 py-1.5">
          {error}
        </div>
      ) : null}

      {isExpired ? (
        <div className="text-[11px] text-warning font-mono bg-warning/10 border border-warning px-2 py-1.5 mt-3">
          This estimate expired on {new Date(estimate.validUntil!).toLocaleDateString()}. Consider voiding and sending a new one.
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
  expired,
}: {
  status: EstimateStatus;
  expired: boolean;
}) {
  if (expired) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 bg-warning/15 text-warning border-warning/40">
        Expired
      </span>
    );
  }
  const palette: Record<EstimateStatus, { bg: string; fg: string; label: string }> = {
    DRAFT: { bg: 'bg-cream', fg: 'text-ink-70 border-line', label: 'Draft' },
    SENT: { bg: 'bg-info/10', fg: 'text-info border-info/40', label: 'Sent' },
    VIEWED: { bg: 'bg-info/15', fg: 'text-info border-info/50', label: '👁 Viewed' },
    APPROVED: { bg: 'bg-success/15', fg: 'text-success border-success/40', label: '✓ Approved' },
    REJECTED: { bg: 'bg-error/10', fg: 'text-error border-error/40', label: '✗ Rejected' },
    CONVERTED: { bg: 'bg-orange/15', fg: 'text-orange border-orange/40', label: 'Converted' },
  };
  const p = palette[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 ${p.bg} ${p.fg}`}
    >
      {p.label}
    </span>
  );
}
