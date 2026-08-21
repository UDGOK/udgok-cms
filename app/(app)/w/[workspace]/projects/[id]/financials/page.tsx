/**
 * /projects/[id]/financials — deep-dive "financial guide" page.
 *
 * The FinancialSummary on the project page is the at-a-glance
 * pulse. This page is the full guide: a walkthrough of where
 * the money is, in a designed layout with help text alongside
 * every metric.
 *
 * Sections:
 *   1. The four numbers that matter (Contract / Billed / AR / Margin)
 *   2. AR — Outstanding receivables, with aging buckets
 *   3. AR — All pay apps history (table)
 *   4. AP — Billables (PO invoices) by status
 *   5. AP — Open POs by status
 *   6. Cost — Sub contract summary
 *   7. Glossary — what each term means
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { getProjectFinancialSummary } from '@/lib/projects/financial-summary';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { ProjectTabsBar } from '../ProjectTabsBar';

interface PageProps {
  params: { workspace: string; id: string };
}

export const dynamic = 'force-dynamic';

export default async function ProjectFinancialsPage({ params }: PageProps) {
  let membership;
  try {
    membership = await requireMembership(params.workspace);
  } catch {
    redirect('/sign-in');
  }
  const { workspace } = membership;

  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      code: true,
      contractValue: true,
      client: { select: { name: true } },
    },
  });
  if (!project) notFound();

  const summary = await getProjectFinancialSummary(project.id);
  const base = `/w/${params.workspace}/projects/${project.id}`;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <MobilePageHeader
        title="Financial guide"
        subtitle={`${project.code ?? 'PROJECT'} · ${project.name} · ${project.client?.name ?? 'No client'}`}
        backHref={`${base}?tab=overview`}
        backLabel="← Project"
      />

      {/* Sub-nav: keeps the project tab bar in context */}
      <div className="mb-5 -mx-4 md:-mx-7">
        <ProjectTabsBar
          workspaceSlug={params.workspace}
          projectId={project.id}
          taskCount={0}
          payAppCount={summary.payAppCounts.DRAFT + summary.payAppCounts.SENT + summary.payAppCounts.VIEWED + summary.payAppCounts.ACKNOWLEDGED + summary.payAppCounts.PAID}
          subAssignmentCount={summary.subCount}
          teamMemberCount={0}
        />
      </div>

      <Hero summary={summary} />

      <ReceivablesSection summary={summary} base={base} />

      <PayAppsHistory summary={summary} base={base} />

      <BillablesSection summary={summary} workspace={params.workspace} />

      <SubContractsSection summary={summary} />

      <Glossary />
    </div>
  );
}

// =================================================================
// Hero — the four numbers that matter
// =================================================================
function Hero({ summary }: { summary: Awaited<ReturnType<typeof getProjectFinancialSummary>> }) {
  const s = summary;
  const marginCls =
    s.estimatedMarginPct < 15
      ? 'border-danger/40 bg-danger/5'
      : s.estimatedMarginPct >= 25
      ? 'border-success/40 bg-success/5'
      : 'border-warning/40 bg-warning/5';
  const marginValueCls =
    s.estimatedMarginPct < 15
      ? 'text-danger'
      : s.estimatedMarginPct >= 25
      ? 'text-success'
      : 'text-warning';

  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return (
    <section className="bg-paper border-2 border-ink mb-6">
      <div className="px-4 md:px-6 py-5 md:py-7 border-b-2 border-ink">
        <div className="label-eyebrow">{'// The four numbers that matter'}</div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
          Where the money is, in one screen
        </h2>
        <p className="text-[12px] text-ink-70 mt-2 max-w-2xl">
          These four metrics tell you the financial health of this project at any
          moment. Anything red needs attention. Anything green is steady.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4">
        <NumberBlock
          label="Contract value"
          helpText="The total amount the client agreed to pay you for this project. Set on the project itself."
          value={fmt(s.contractValue)}
          sub={s.contractValue > 0 ? 'agreed scope' : 'not set'}
        />
        <NumberBlock
          label="Billed to date"
          helpText="The sum of every pay app that has left the door — sent, viewed, acknowledged, or paid. Drafts do not count."
          value={fmt(s.totalBilled)}
          sub={
            s.contractValue > 0
              ? `${s.percentBilled}% of contract`
              : 'no contract set'
          }
          progress={s.percentBilled}
          progressColor="bg-success"
        />
        <NumberBlock
          label="Outstanding AR"
          helpText="Receivables — money the client owes you but hasn't paid yet. Sent, viewed, or acknowledged pay apps."
          value={fmt(s.outstandingAr)}
          sub={
            s.outstandingReceivables.length > 0
              ? `${s.outstandingReceivables.length} pay app${
                  s.outstandingReceivables.length === 1 ? '' : 's'
                } open`
              : 'all caught up'
          }
          tone={s.outstandingAr > 0 ? 'warning' : 'default'}
        />
        <div className={`p-4 md:p-6 border-r border-b md:border-b-0 last:border-r-0 border-line ${marginCls}`}>
          <div className="label-mono">Estimated margin</div>
          <div className={`font-black text-2xl md:text-3xl ${marginValueCls}`}>
            {s.contractValue > 0 ? `${s.estimatedMarginPct}%` : '—'}
          </div>
          <div className="text-[10px] md:text-[11px] text-ink-50 mt-1">
            {s.contractValue > 0 ? `${fmt(s.estimatedMargin)} kept` : 'set contract to see'}
          </div>
          {s.contractValue > 0 && s.estimatedMarginPct < 15 ? (
            <div className="text-[10px] text-danger mt-2 font-bold leading-tight">
              ⚠ Below 15% — review sub costs or change orders.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function NumberBlock({
  label,
  helpText,
  value,
  sub,
  progress,
  progressColor,
  tone,
}: {
  label: string;
  helpText: string;
  value: string;
  sub?: string;
  progress?: number;
  progressColor?: string;
  tone?: 'warning' | 'default';
}) {
  return (
    <div className="p-4 md:p-6 border-r border-b md:border-b-0 last:border-r-0 border-line">
      <div className="flex items-start justify-between gap-2">
        <div className="label-mono">{label}</div>
        <div className="group relative flex-shrink-0">
          <button
            type="button"
            aria-label={`What is ${label}?`}
            className="w-4 h-4 rounded-full border border-line text-ink-50 text-[10px] font-bold flex items-center justify-center hover:bg-ink hover:text-cream transition-colors"
          >
            ?
          </button>
          <div className="hidden group-hover:block absolute right-0 top-6 z-10 w-64 p-3 bg-ink text-cream text-[11px] leading-snug shadow-lg pointer-events-none">
            {helpText}
          </div>
        </div>
      </div>
      <div className={`font-black text-2xl md:text-3xl mt-1 ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>
        {value}
      </div>
      {sub ? <div className="text-[10px] md:text-[11px] text-ink-50 mt-1">{sub}</div> : null}
      {typeof progress === 'number' && progress > 0 ? (
        <div className="mt-2 h-1 bg-cream-2 border border-line overflow-hidden">
          <div
            className={`h-full ${progressColor ?? 'bg-ink'}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

// =================================================================
// Receivables — pay apps in flight, with aging
// =================================================================
function ReceivablesSection({
  summary,
  base,
}: {
  summary: Awaited<ReturnType<typeof getProjectFinancialSummary>>;
  workspace?: string;
  base: string;
}) {
  const s = summary;
  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  // Aging buckets
  const buckets = { lt30: 0, d30: 0, d60: 0, d90: 0 };
  for (const r of s.outstandingReceivables) {
    if (r.daysSinceSent < 30) buckets.lt30 += r.totalThisDraw;
    else if (r.daysSinceSent < 60) buckets.d30 += r.totalThisDraw;
    else if (r.daysSinceSent < 90) buckets.d60 += r.totalThisDraw;
    else buckets.d90 += r.totalThisDraw;
  }

  return (
    <section className="bg-paper border-2 border-line mb-6">
      <div className="px-4 md:px-6 py-4 md:py-5 border-b-2 border-line flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow">{'// Accounts receivable'}</div>
          <h3 className="font-black text-xl md:text-2xl tracking-tight mt-1">
            Pay apps in flight
          </h3>
          <p className="text-[12px] text-ink-70 mt-1 max-w-2xl">
            Every pay app you sent that hasn&apos;t been paid yet. Older items need
            follow-up — the longer a receivable ages, the less likely it gets paid.
          </p>
        </div>
        <Link
          href={`${base}/pay-apps`}
          className="px-3 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors flex-shrink-0"
        >
          All pay apps →
        </Link>
      </div>

      {/* Aging strip */}
      <div className="grid grid-cols-4 border-b border-line">
        <AgingCell label="0–30 days" amount={buckets.lt30} tone="default" />
        <AgingCell label="31–60 days" amount={buckets.d30} tone="warning" />
        <AgingCell label="61–90 days" amount={buckets.d60} tone="warning" />
        <AgingCell label="90+ days" amount={buckets.d90} tone="danger" />
      </div>

      {/* Outstanding list */}
      {s.outstandingReceivables.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-2xl mb-2">✓</div>
          <div className="font-extrabold text-base">No outstanding receivables</div>
          <p className="text-[11px] text-ink-50 mt-1">
            Every pay app you sent has been paid. Nice.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                {['Draw', 'Period', 'This draw', 'Days out', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 md:px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.outstandingReceivables.map((p) => {
                const ageTone =
                  p.daysSinceSent >= 90
                    ? 'text-danger font-extrabold'
                    : p.daysSinceSent >= 30
                    ? 'text-warning font-extrabold'
                    : 'text-ink font-bold';
                return (
                  <tr key={p.id} className="border-b border-line-soft last:border-0">
                    <td className="px-3 md:px-5 py-3 font-extrabold text-[12px]">
                      <div className="w-9 h-9 bg-cream-2 border border-line flex items-center justify-center font-black text-sm">
                        {p.drawNumber}
                      </div>
                    </td>
                    <td className="px-3 md:px-5 py-3 text-[11px] font-mono text-ink-70">
                      {new Date(p.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(p.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 md:px-5 py-3 font-extrabold text-[13px]">
                      {fmt(p.totalThisDraw)}
                    </td>
                    <td className={`px-3 md:px-5 py-3 text-[13px] ${ageTone}`}>
                      {p.daysSinceSent}d
                    </td>
                    <td className="px-3 md:px-5 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                          p.status === 'ACKNOWLEDGED'
                            ? 'bg-success/15 text-success border border-success/30'
                            : p.status === 'VIEWED'
                            ? 'bg-info/15 text-info border border-info/30'
                            : 'bg-warning/15 text-warning border border-warning/30'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 text-right">
                      <Link
                        href={`${base}/pay-apps/${p.id}`}
                        className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:text-ink"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AgingCell({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: 'default' | 'warning' | 'danger';
}) {
  const cls =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warning'
      ? 'text-warning'
      : 'text-ink';
  return (
    <div className="p-3 md:p-4 border-r border-line last:border-r-0">
      <div className="label-mono">{label}</div>
      <div className={`font-black text-lg md:text-xl ${cls}`}>
        {amount > 0 ? `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
      </div>
    </div>
  );
}

// =================================================================
// Pay apps history — full table
// =================================================================
function PayAppsHistory({
  summary,
  base,
}: {
  summary: Awaited<ReturnType<typeof getProjectFinancialSummary>>;
  base: string;
}) {
  const s = summary;
  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <section className="bg-paper border-2 border-line mb-6">
      <div className="px-4 md:px-6 py-4 md:py-5 border-b-2 border-line">
        <div className="label-eyebrow">{'// Pay apps history'}</div>
        <h3 className="font-black text-xl md:text-2xl tracking-tight mt-1">
          Every draw on this project
        </h3>
        <p className="text-[12px] text-ink-70 mt-1 max-w-2xl">
          A complete ledger of pay applications — from draft to paid. The running
          total is the cumulative amount billed.
        </p>
      </div>

      {s.recentPayApps.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="font-extrabold text-base mb-1">No pay apps yet</div>
          <p className="text-[11px] text-ink-50 mb-3">
            Add a schedule of values first, then generate your first draw.
          </p>
          <Link
            href={`${base}/pay-apps/new`}
            className="inline-block px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors"
          >
            + Generate first pay app
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr>
                {['#', 'Period', 'This draw', 'Running total', 'Balance', 'Status', 'Sent', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 md:px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.recentPayApps.map((p) => (
                <tr key={p.id} className="border-b border-line-soft last:border-0 hover:bg-cream-2/40">
                  <td className="px-3 md:px-5 py-3">
                    <div className="w-9 h-9 bg-cream-2 border border-line flex items-center justify-center font-black text-sm">
                      {p.drawNumber}
                    </div>
                  </td>
                  <td className="px-3 md:px-5 py-3 text-[11px] font-mono text-ink-70">
                    {new Date(p.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    {' – '}
                    {new Date(p.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="px-3 md:px-5 py-3 font-extrabold text-[13px]">
                    {fmt(p.totalThisDraw)}
                  </td>
                  <td className="px-3 md:px-5 py-3 text-[12px]">
                    {fmt(p.totalContract - p.totalBalance)}
                  </td>
                  <td className="px-3 md:px-5 py-3 text-[12px] text-ink-70">
                    {fmt(p.totalBalance)}
                  </td>
                  <td className="px-3 md:px-5 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-3 md:px-5 py-3 text-[10px] font-mono text-ink-50">
                    {p.sentAt
                      ? new Date(p.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-3 md:px-5 py-3 text-right">
                    <Link
                      href={`${base}/pay-apps/${p.id}`}
                      className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:text-ink"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// =================================================================
// Billables — vendor invoices (PO invoices)
// =================================================================
function BillablesSection({
  summary,
  workspace,
}: {
  summary: Awaited<ReturnType<typeof getProjectFinancialSummary>>;
  workspace: string;
}) {
  const s = summary;
  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <section className="bg-paper border-2 border-line mb-6">
      <div className="px-4 md:px-6 py-4 md:py-5 border-b-2 border-line flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow">{'// Accounts payable — billables'}</div>
          <h3 className="font-black text-xl md:text-2xl tracking-tight mt-1">
            What subs are billing you
          </h3>
          <p className="text-[12px] text-ink-70 mt-1 max-w-2xl">
            A billable is a vendor invoice tied to a PO on this project. You
            approve it, then mark it paid. Until it&apos;s paid, the vendor is
            waiting on you.
          </p>
        </div>
        <Link
          href={`/w/${workspace}/procurement`}
          className="px-3 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors flex-shrink-0"
        >
          Procurement →
        </Link>
      </div>

      {/* Status buckets */}
      <div className="grid grid-cols-2 md:grid-cols-5 border-b border-line">
        {(
          [
            ['SUBMITTED', 'Submitted', 'warning'],
            ['APPROVED', 'Approved', 'info'],
            ['PAID', 'Paid', 'success'],
            ['DISPUTED', 'Disputed', 'danger'],
            ['VOID', 'Void', 'default'],
          ] as const
        ).map(([key, label]) => {
          const amount = key === 'SUBMITTED'
            ? s.invoicePendingApproval
            : key === 'APPROVED'
            ? s.invoiceApprovedUnpaid
            : key === 'PAID'
            ? s.invoiceTotalPaid
            : 0; // DISPUTED + VOID not summed
          return (
            <div key={key} className="p-3 md:p-4 border-r border-line last:border-r-0">
              <div className="label-mono">{label}</div>
              <div className="font-black text-lg md:text-xl">
                {amount > 0 ? fmt(amount) : '—'}
              </div>
              <div className="text-[10px] text-ink-50 mt-0.5">
                {s.invoiceCounts[key] ?? 0} invoice{(s.invoiceCounts[key] ?? 0) === 1 ? '' : 's'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent invoices list */}
      {s.recentInvoices.length === 0 ? (
        <div className="px-6 py-10 text-center text-ink-50 text-sm">
          No vendor invoices yet on this project.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                {['Vendor', 'PO #', 'Invoice #', 'Amount', 'Date', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 md:px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.recentInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-line-soft last:border-0">
                  <td className="px-3 md:px-5 py-3 font-extrabold text-[12px]">
                    {inv.vendorName}
                  </td>
                  <td className="px-3 md:px-5 py-3 text-[11px] font-mono text-ink-70">
                    {inv.poNumber}
                  </td>
                  <td className="px-3 md:px-5 py-3 text-[11px] font-mono">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-3 md:px-5 py-3 font-extrabold text-[13px]">
                    {fmt(inv.invoiceAmount)}
                  </td>
                  <td className="px-3 md:px-5 py-3 text-[11px] font-mono text-ink-50">
                    {new Date(inv.invoiceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 md:px-5 py-3">
                    <StatusPill status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// =================================================================
// Sub contracts summary
// =================================================================
function SubContractsSection({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getProjectFinancialSummary>>;
}) {
  const s = summary;
  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <section className="bg-paper border-2 border-line mb-6">
      <div className="px-4 md:px-6 py-4 md:py-5 border-b-2 border-line">
        <div className="label-eyebrow">{'// Sub cost summary'}</div>
        <h3 className="font-black text-xl md:text-2xl tracking-tight mt-1">
          Committed to subs
        </h3>
        <p className="text-[12px] text-ink-70 mt-1 max-w-2xl">
          Subcontracted scope committed on this project. The difference between
          this and your contract value is your gross margin.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3">
        <div className="p-4 md:p-6 border-r border-b md:border-b-0 border-line">
          <div className="label-mono">Sub contracts</div>
          <div className="font-black text-2xl md:text-3xl">{s.subCount}</div>
          <div className="text-[10px] text-ink-50 mt-1">
            {s.subCount === 1 ? 'sub on the job' : 'subs on the job'}
          </div>
        </div>
        <div className="p-4 md:p-6 border-r border-line">
          <div className="label-mono">Committed to subs</div>
          <div className="font-black text-2xl md:text-3xl">{fmt(s.totalSubContractAmount)}</div>
          <div className="text-[10px] text-ink-50 mt-1">
            {s.contractValue > 0
              ? `${Math.round((s.totalSubContractAmount / s.contractValue) * 100)}% of contract`
              : 'no contract set'}
          </div>
        </div>
        <div className="p-4 md:p-6">
          <div className="label-mono">Schedule of values budget</div>
          <div className="font-black text-2xl md:text-3xl">{fmt(s.totalDivisionBudget)}</div>
          <div className="text-[10px] text-ink-50 mt-1">
            across all divisions
          </div>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// Glossary
// =================================================================
function Glossary() {
  return (
    <section className="bg-cream-2 border-2 border-line mb-6">
      <div className="px-4 md:px-6 py-4 md:py-5 border-b border-line">
        <div className="label-eyebrow">{'// Glossary'}</div>
        <h3 className="font-black text-xl tracking-tight mt-1">What the words mean</h3>
      </div>
      <dl className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <GlossaryItem
          term="Contract value"
          def="The total amount the client agreed to pay you for the whole project. Set on the project itself."
        />
        <GlossaryItem
          term="Billed to date"
          def="Cumulative amount on pay apps that have left the door — sent, viewed, acknowledged, or paid. Drafts don't count yet."
        />
        <GlossaryItem
          term="Outstanding AR (Accounts Receivable)"
          def="Money the client owes you but hasn't paid. Sent, viewed, or acknowledged pay apps minus any paid ones."
        />
        <GlossaryItem
          term="Balance to bill"
          def="Contract value minus billed to date. What you have left to invoice on this project."
        />
        <GlossaryItem
          term="Pay app"
          def="A billing application (AIA G702/G703 style) that itemizes work completed this period and asks the client to pay."
        />
        <GlossaryItem
          term="Billable / vendor invoice"
          def="A bill a sub sends you against a PO. You approve it, then mark it paid. The full lifecycle is in the Procurement tab."
        />
        <GlossaryItem
          term="Estimated margin"
          def="Contract value minus committed sub cost. A rough estimate — actual margin depends on change orders, materials, and overhead."
        />
        <GlossaryItem
          term="Aging buckets"
          def="How long a receivable has been open. 0–30 days is normal. 30–60 is a follow-up. 60+ needs a phone call. 90+ is at risk."
        />
      </dl>
    </section>
  );
}

function GlossaryItem({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <dt className="font-extrabold text-[13px]">{term}</dt>
      <dd className="text-[11px] text-ink-70 mt-0.5 leading-relaxed">{def}</dd>
    </div>
  );
}

// =================================================================
// Status pill — shared
// =================================================================
function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
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
  const c = cls[status] ?? 'bg-cream-2 text-ink-50';
  return (
    <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${c}`}>
      {status}
    </span>
  );
}
