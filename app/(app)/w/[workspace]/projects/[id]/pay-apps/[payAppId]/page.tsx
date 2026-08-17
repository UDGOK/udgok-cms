import { notFound } from 'next/navigation';
import { getPayApp } from '@/lib/pay-apps/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { listEntityActivity } from '@/lib/activity/queries';
import { SendPayAppForm } from './SendPayAppForm';
import { PayAppEditor, PayAppStatusActions } from './PayAppControls';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import Link from 'next/link';

const PAY_APP_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  ACKNOWLEDGED: 'Acknowledged',
  PAID: 'Paid',
  DISPUTED: 'Disputed',
};

const PAY_APP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-cream-2 text-ink-50',
  SENT: 'bg-ink text-cream',
  VIEWED: 'bg-orange-l text-ink',
  ACKNOWLEDGED: 'bg-orange text-paper',
  PAID: 'bg-success text-paper',
  DISPUTED: 'bg-error text-paper',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default async function PayAppDetailPage({
  params,
}: {
  params: { workspace: string; id: string; payAppId: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const payApp = await getPayApp(workspace.id, params.payAppId);
  if (!payApp || payApp.projectId !== params.id) notFound();

  const activity = await listEntityActivity(workspace.id, 'pay_app', payApp.id);

  const publicUrl = `${APP_URL}/pay-apps/${payApp.shareToken}`;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap pb-7 border-b border-line bg-paper p-7 -m-7 mb-7">
        <div>
          <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-ink-50 mb-1">
            PAY APP · #{payApp.drawNumber} · {payApp.project.name}
          </div>
          <h2 className="text-3xl font-black tracking-tight leading-tight">
            {payApp.project.client?.name ?? 'No client'}
          </h2>
          <div className="font-mono text-[10px] text-ink-50 tracking-[0.12em] uppercase mt-2">
            PERIOD {payApp.periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {payApp.periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
              PAY_APP_STATUS_COLOR[payApp.status] ?? 'bg-cream-2 text-ink-50'
            }`}
          >
            {PAY_APP_STATUS_LABELS[payApp.status]}
          </span>
          <div className="text-2xl font-black">${Number(payApp.totalThisDraw).toLocaleString()}</div>
          <div className="text-[10px] font-mono text-ink-50 uppercase tracking-[0.1em]">THIS DRAW</div>
        </div>
      </div>

      {/* Tracking row */}
      <div className="grid grid-cols-1 md:grid-cols-4 border border-line bg-paper mb-6">
        <div className="p-4 border-r border-line">
          <div className="label-mono">Views</div>
          <div className="font-black text-2xl">{payApp.viewCount}</div>
        </div>
        <div className="p-4 border-r border-line">
          <div className="label-mono">First viewed</div>
          <div className="font-extrabold text-[13px]">
            {payApp.firstViewedAt
              ? payApp.firstViewedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              : '—'}
          </div>
        </div>
        <div className="p-4 border-r border-line">
          <div className="label-mono">Sent to</div>
          <div className="font-extrabold text-[13px]">{payApp.sentToEmail ?? '—'}</div>
          {payApp.sentAt ? (
            <div className="text-[10px] text-ink-50 mt-0.5 font-mono">{payApp.sentAt.toLocaleString()}</div>
          ) : null}
        </div>
        <div className="p-4">
          <div className="label-mono">Acknowledged</div>
          <div className="font-extrabold text-[13px]">
            {payApp.acknowledgedAt
              ? payApp.acknowledgedAt.toLocaleString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </div>
        </div>
      </div>

      {/* Public URL */}
      <div className="bg-paper border-2 border-line p-5 mb-6">
        <div className="label-eyebrow mb-3">{'// Public share link'}</div>
        <div className="flex gap-2 items-stretch">
          <input
            readOnly
            value={publicUrl}
            className="flex-1 px-3 py-2 bg-cream border border-line text-ink text-[12px] font-mono outline-none"
          />
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors"
          >
            Open ↗
          </a>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-paper border-2 border-line mb-6">
        <div className="px-6 py-4 border-b border-line">
          <div className="label-eyebrow">{'// Schedule of values'}</div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Code', 'Description', 'Previous', 'This Draw', 'Balance'].map((h) => (
                <th key={h} className="text-left px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payApp.divisions.map((line) => (
              <tr key={line.id}>
                <td className="px-5 py-3 border-b border-line-soft font-mono text-[12px]">{line.projectDivision.code}</td>
                <td className="px-5 py-3 border-b border-line-soft font-extrabold text-[13px]">{line.projectDivision.trade}</td>
                <td className="px-5 py-3 border-b border-line-soft font-extrabold">${Number(line.previousAmount).toLocaleString()}</td>
                <td className="px-5 py-3 border-b border-line-soft font-black text-orange-d">${Number(line.thisDrawAmount).toLocaleString()}</td>
                <td className="px-5 py-3 border-b border-line-soft font-extrabold">${Number(line.balanceAfter).toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-ink text-cream">
              <td colSpan={2} className="px-5 py-3 font-extrabold uppercase text-[11px] tracking-[0.12em]">Totals</td>
              <td className="px-5 py-3 font-black text-lg">${Number(payApp.totalPrevious).toLocaleString()}</td>
              <td className="px-5 py-3 font-black text-lg text-orange-l">${Number(payApp.totalThisDraw).toLocaleString()}</td>
              <td className="px-5 py-3 font-black text-lg">${Number(payApp.totalBalance).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {payApp.notes ? (
        <div className="bg-paper border-2 border-line p-6 mb-6">
          <div className="label-eyebrow mb-3">{'// Notes'}</div>
          <p className="text-[13px] text-ink-70 whitespace-pre-wrap">{payApp.notes}</p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="bg-paper border-2 border-line p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="label-eyebrow">{'// Actions'}</div>
          <PayAppStatusActions
            workspaceSlug={params.workspace}
            projectId={params.id}
            payAppId={payApp.id}
            drawNumber={payApp.drawNumber}
            status={payApp.status}
          />
        </div>
        {payApp.status === 'DRAFT' ? (
          <div>
            <p className="text-[11px] text-ink-50 mb-3">
              Edit the this-draw amounts before sending. Once sent, the numbers are locked.
            </p>
            <PayAppEditor
              workspaceSlug={params.workspace}
              projectId={params.id}
              payAppId={payApp.id}
              initialNotes={payApp.notes ?? ''}
              initialLines={payApp.divisions.map((d) => ({
                id: d.id,
                previousAmount: Number(d.previousAmount),
                thisDrawAmount: Number(d.thisDrawAmount),
                balanceAfter: Number(d.balanceAfter),
                code: d.projectDivision.code,
                trade: d.projectDivision.trade,
                budget: 0, // not needed for editing
              }))}
            />
          </div>
        ) : payApp.status === 'SENT' || payApp.status === 'VIEWED' || payApp.status === 'ACKNOWLEDGED' ? (
          <SendPayAppForm
            workspaceSlug={params.workspace}
            projectId={params.id}
            payAppId={payApp.id}
            defaultEmail={payApp.sentToEmail ?? payApp.project.client?.email ?? ''}
          />
        ) : (
          <p className="text-ink-50 text-sm">No actions available in status {PAY_APP_STATUS_LABELS[payApp.status]}.</p>
        )}

        {payApp.viewEvents.length > 0 ? (
          <div className="mt-6 pt-6 border-t border-line">
            <div className="label-eyebrow mb-3">{'// Recent views'}</div>
            <div className="space-y-1">
              {payApp.viewEvents.slice(0, 10).map((e) => (
                <div key={e.id} className="text-[11px] font-mono text-ink-70 flex gap-3">
                  <span className="text-ink-50">{e.viewedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  <span>{e.viewerEmail ?? 'anonymous'}</span>
                  {e.ipAddress ? <span className="text-ink-50">{e.ipAddress}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-7">
        <Link
          href={`/w/${params.workspace}/projects/${params.id}`}
          className="text-xs text-ink-50 hover:text-ink"
        >
          ← Back to project
        </Link>
      </div>

      {/* History */}
      <div className="mt-7 bg-paper border-2 border-line p-6">
        <h2 className="label-eyebrow mb-4">{'// History'}</h2>
        <ActivityFeed entries={activity} showEntityName={false} />
      </div>
    </div>
  );
}
