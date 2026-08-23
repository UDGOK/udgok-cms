/**
 * FinancialSummary — embedded at the top of the project page.
 *
 * A polished "at-a-glance" financial card. Shows:
 *   - 4-cell KPI strip (Contract / Billed / Outstanding / Margin)
 *   - Pay apps snapshot (status counts + recent list)
 *   - Billables snapshot (PO invoices: pending / approved / paid)
 *   - Subs summary (how much is committed to subs)
 *
 * The bigger /financials route on this same project is the
 * deep-dive "guide" — this component is the pulse.
 *
 * Visual style follows the Atelier design system: paper
 * background, ink borders, mono labels, generous spacing.
 */

import Link from 'next/link';
import type { ProjectFinancialSummary } from '@/lib/projects/financial-summary';
import { fmtDate } from '@/lib/format/currency';

interface Props {
  workspace: string;
  projectId: string;
  summary: ProjectFinancialSummary;
  /** "compact" hides secondary sections (used on mobile) */
  compact?: boolean;
}

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;


const STATUS_COLOR: Record<string, string> = {
  DRAFT:           'bg-line text-ink-50',
  SENT:            'bg-info/15 text-info border border-info/30',
  VIEWED:          'bg-info/25 text-info border border-info/40',
  ACKNOWLEDGED:    'bg-success/15 text-success border border-success/30',
  PAID:            'bg-success text-paper',
  DISPUTED:        'bg-danger/15 text-danger border border-danger/30',
  SUPERSEDED:      'bg-cream-2 text-ink-50',
  SUBMITTED:       'bg-warning/15 text-warning border border-warning/30',
  APPROVED:        'bg-info/15 text-info border border-info/30',
  VOID:            'bg-cream-2 text-ink-50',
};

function Pill({ status }: { status: string }) {
  const cls = STATUS_COLOR[status] ?? 'bg-cream-2 text-ink-50';
  return (
    <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${cls}`}>
      {status}
    </span>
  );
}

export function FinancialSummary({ workspace, projectId, summary, compact }: Props) {
  const s = summary;
  const base = `/w/${workspace}/projects/${projectId}`;

  const marginWarn = s.contractValue > 0 && s.estimatedMarginPct < 15;
  const marginGood = s.estimatedMarginPct >= 25;

  return (
    <section className="bg-paper border-2 border-ink mb-6">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 md:py-5 border-b-2 border-ink flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="label-eyebrow">{'// Financial summary'}</div>
          <h3 className="font-black text-xl md:text-2xl tracking-tight mt-1">
            Money in, money out
          </h3>
          <p className="text-[12px] text-ink-70 mt-1 max-w-2xl">
            <span className="font-bold">Pay apps</span> are what you bill the client.
            <span className="font-bold"> Billables</span> are what subs bill you (PO invoices).
            <span className="font-bold"> Margin</span> is contract minus committed sub cost.
          </p>
        </div>
        <Link
          href={`${base}/financials`}
          className="px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors flex-shrink-0"
        >
          Open the guide →
        </Link>
      </div>

      {/* 4-cell KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-line">
        <KpiCell
          label="Contract value"
          value={fmtMoney(s.contractValue)}
          sub={s.contractValue > 0 ? 'agreed scope' : 'set on project'}
          tone="default"
        />
        <KpiCell
          label="Billed to date"
          value={fmtMoney(s.totalBilled)}
          sub={
            s.contractValue > 0
              ? `${s.percentBilled}% of contract`
              : 'no contract set'
          }
          tone="success"
          progress={s.percentBilled}
        />
        <KpiCell
          label="Outstanding (AR)"
          value={fmtMoney(s.outstandingAr)}
          sub={
            s.outstandingReceivables.length > 0
              ? `${s.outstandingReceivables.length} pay app${
                  s.outstandingReceivables.length === 1 ? '' : 's'
                } open`
              : 'all caught up'
          }
          tone={s.outstandingAr > 0 ? 'warning' : 'default'}
        />
        <KpiCell
          label="Estimated margin"
          value={
            s.contractValue > 0
              ? `${s.estimatedMarginPct}%`
              : '—'
          }
          sub={
            s.contractValue > 0
              ? `${fmtMoney(s.estimatedMargin)} kept`
              : 'set contract to see'
          }
          tone={marginWarn ? 'danger' : marginGood ? 'success' : 'default'}
        />
      </div>

      {/* Pay apps + Billables — 2-col on desktop, stacked on mobile */}
      {!compact && (
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-line">
          {/* Pay apps */}
          <div className="border-b lg:border-b-0 lg:border-r border-line p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="label-eyebrow">{'// Pay apps'}</div>
                <div className="text-[11px] text-ink-50 mt-0.5">
                  What you bill the client
                </div>
              </div>
              <Link
                href={`${base}/pay-apps`}
                className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:text-ink"
              >
                All →
              </Link>
            </div>

            {/* Status counts strip */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(
                [
                  ['DRAFT', 'Draft'],
                  ['SENT', 'Sent'],
                  ['VIEWED', 'Viewed'],
                  ['ACKNOWLEDGED', 'Acked'],
                  ['PAID', 'Paid'],
                ] as const
              ).map(([key, label]) => {
                const count = s.payAppCounts[key];
                if (!count) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 px-2 py-1 border border-line bg-cream-2"
                    title={`${count} pay app${count === 1 ? '' : 's'} ${label.toLowerCase()}`}
                  >
                    <Pill status={key} />
                    <span className="text-[11px] font-extrabold">{count}</span>
                  </div>
                );
              })}
              {Object.values(s.payAppCounts).every((c) => c === 0) ? (
                <div className="text-[11px] text-ink-50 italic">No pay apps yet.</div>
              ) : null}
            </div>

            {/* Last 3 pay apps */}
            {s.recentPayApps.length > 0 ? (
              <div className="border-t border-line-soft">
                {s.recentPayApps.slice(0, 3).map((p, i) => (
                  <Link
                    key={p.id}
                    href={`${base}/pay-apps/${p.id}`}
                    className={`flex items-center gap-3 py-2.5 hover:bg-cream-2 -mx-2 px-2 ${
                      i < s.recentPayApps.slice(0, 3).length - 1 ? 'border-b border-line-soft' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-cream-2 border border-line flex flex-col items-center justify-center">
                      <div className="text-[7px] font-mono text-ink-50 uppercase tracking-[0.1em]">DRAW</div>
                      <div className="font-black text-sm leading-none">{p.drawNumber}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-[12px]">{fmtMoney(p.totalThisDraw)}</div>
                      <div className="text-[10px] text-ink-50 font-mono">
                        {fmtDate(p.periodStart)}–{fmtDate(p.periodEnd)}
                      </div>
                    </div>
                    <Pill status={p.status} />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {/* Billables (PO invoices) */}
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="label-eyebrow">{'// Billables'}</div>
                <div className="text-[11px] text-ink-50 mt-0.5">
                  What subs bill you (PO invoices)
                </div>
              </div>
              <Link
                href={`/w/${workspace}/procurement`}
                className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:text-ink"
              >
                Procurement →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <MiniCell
                label="Awaiting"
                value={s.invoicePendingApproval}
                tone="warning"
                hint="submitted, not approved"
              />
              <MiniCell
                label="Approved"
                value={s.invoiceApprovedUnpaid}
                tone="info"
                hint="ready to pay"
              />
              <MiniCell
                label="Paid"
                value={s.invoiceTotalPaid}
                tone="success"
                hint="all time"
              />
            </div>

            {s.recentInvoices.length > 0 ? (
              <div className="border-t border-line-soft">
                {s.recentInvoices.slice(0, 3).map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`flex items-center gap-3 py-2.5 ${
                      i < Math.min(2, s.recentInvoices.length - 1) ? 'border-b border-line-soft' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-[12px] truncate">
                        {inv.vendorName}
                      </div>
                      <div className="text-[10px] text-ink-50 font-mono truncate">
                        {inv.poNumber} · {inv.invoiceNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-[12px]">{fmtMoney(inv.invoiceAmount)}</div>
                      <div className="mt-0.5">
                        <Pill status={inv.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-ink-50 italic mt-2">
                No vendor invoices yet. Issue a PO to a sub to start.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subs + Committed strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 border-t border-line-soft">
        <KpiCell
          label="Sub contracts"
          value={s.subCount > 0 ? `${s.subCount}` : '—'}
          sub={s.subCount === 1 ? 'sub on the job' : `${s.subCount} subs on the job`}
          tone="default"
        />
        <KpiCell
          label="Committed to subs"
          value={fmtMoney(s.totalSubContractAmount)}
          sub={
            s.contractValue > 0
              ? `${Math.round((s.totalSubContractAmount / s.contractValue) * 100)}% of contract`
              : 'no contract'
          }
          tone="default"
        />
        <KpiCell
          label="Open POs"
          value={fmtMoney(s.poOpenTotal)}
          sub={
            s.poOpenTotal > 0
              ? `${s.poCounts.ISSUED + s.poCounts.ACKNOWLEDGED + s.poCounts.PARTIALLY_RECEIVED} open`
              : 'none outstanding'
          }
          tone="default"
        />
      </div>
    </section>
  );
}

function KpiCell({
  label,
  value,
  sub,
  tone,
  progress,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'info';
  progress?: number;
}) {
  const valueColor =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
      ? 'text-warning'
      : tone === 'danger'
      ? 'text-danger'
      : tone === 'info'
      ? 'text-info'
      : 'text-ink';
  return (
    <div className="p-4 md:p-5 border-r border-b md:border-b-0 last:border-r-0 border-line">
      <div className="label-mono">{label}</div>
      <div className={`font-black text-xl md:text-2xl ${valueColor}`}>{value}</div>
      {sub ? <div className="text-[10px] md:text-[11px] text-ink-50 mt-1">{sub}</div> : null}
      {typeof progress === 'number' && progress > 0 ? (
        <div className="mt-2 h-1 bg-cream-2 border border-line overflow-hidden">
          <div
            className="h-full bg-success"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MiniCell({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'info';
  hint: string;
}) {
  const cls =
    tone === 'success'
      ? 'border-success/40 bg-success/5'
      : tone === 'warning'
      ? 'border-warning/40 bg-warning/5'
      : 'border-info/40 bg-info/5';
  const labelCls =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
      ? 'text-warning'
      : 'text-info';
  return (
    <div className={`p-2.5 border ${cls}`}>
      <div className={`text-[9px] font-mono uppercase tracking-[0.1em] ${labelCls}`}>
        {label}
      </div>
      <div className="font-black text-base mt-0.5">{fmtMoney(value)}</div>
      <div className="text-[9px] text-ink-50 mt-0.5 leading-tight">{hint}</div>
    </div>
  );
}
