import { notFound } from 'next/navigation';
import { getDeal } from '@/lib/deals/queries';
import { DEAL_STAGE_LABELS, DEAL_STAGES, type DealStage } from '@/lib/deals/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { Button, StatusBadge } from '@/components/ui';
import { ConvertToProjectButton } from './ConvertToProjectButton';

export default async function DealDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const deal = await getDeal(workspace.id, params.id);
  if (!deal) notFound();

  const stage: DealStage = deal.stage as DealStage;
  const stageIdx = DEAL_STAGES.indexOf(stage);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap pb-7 border-b border-line bg-paper p-7 -m-7 mb-7">
        <div>
          <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-ink-50 mb-1">
            DEAL · {deal.id.slice(0, 8).toUpperCase()}
          </div>
          <h2 className="text-3xl font-black tracking-tight leading-tight">{deal.title}</h2>
          <div className="font-mono text-[10px] text-ink-50 tracking-[0.12em] uppercase mt-2">
            {deal.client.name} · {deal.property ? deal.property.label : 'No property'} · CREATED {deal.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={stage === 'WON' ? 'active' : stage === 'LOST' ? 'inactive' : 'active'} />
          <div className="text-2xl font-black">${Number(deal.value).toLocaleString()}</div>
          {deal.margin ? (
            <div className="text-[11px] text-ink-50">Margin: {deal.margin}%</div>
          ) : null}
        </div>
      </div>

      {/* Stage rail */}
      <div className="bg-paper border border-line p-5 mb-6">
        <div className="label-eyebrow mb-3">{'// Pipeline'}</div>
        <div className="grid grid-cols-6 gap-2">
          {DEAL_STAGES.map((s, i) => {
            const isActive = i === stageIdx;
            const isPast = i < stageIdx;
            return (
              <div
                key={s}
                className={`p-3 text-center ${
                  isActive
                    ? 'bg-orange text-paper'
                    : isPast
                      ? 'bg-ink text-cream'
                      : 'bg-cream-2 text-ink-50'
                }`}
              >
                <div className="text-[9px] font-mono tracking-[0.1em] uppercase mb-0.5">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="font-extrabold uppercase text-[11px] tracking-[0.08em]">
                  {DEAL_STAGE_LABELS[s]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Notes */}
        <div className="md:col-span-2 bg-paper border border-line p-6">
          <div className="label-eyebrow mb-4">{'// Activity'}</div>
          {deal.notes.length === 0 ? (
            <p className="text-ink-50 text-sm">No notes yet. Add one to start the conversation.</p>
          ) : (
            <div className="space-y-4">
              {deal.notes.map((n) => (
                <div key={n.id} className="pb-4 border-b border-line-soft last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-ink text-cream flex items-center justify-center font-black text-xs">
                      {(n.author?.name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="font-extrabold text-[13px]">{n.author?.name ?? 'Unknown'}</div>
                      <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em]">
                        {n.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] text-ink-70 mt-2">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-paper border border-line p-5">
            <div className="label-eyebrow mb-3">{'// Details'}</div>
            <div className="space-y-3 text-[13px]">
              <div>
                <div className="label-mono">VALUE</div>
                <div className="font-black text-lg">${Number(deal.value).toLocaleString()}</div>
              </div>
              {deal.expectedClose ? (
                <div>
                  <div className="label-mono">EXPECTED CLOSE</div>
                  <div className="font-extrabold">{deal.expectedClose.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              ) : null}
              {deal.margin ? (
                <div>
                  <div className="label-mono">MARGIN</div>
                  <div className="font-extrabold">{deal.margin}%</div>
                </div>
              ) : null}
              {deal.description ? (
                <div>
                  <div className="label-mono">DESCRIPTION</div>
                  <div className="text-ink-70">{deal.description}</div>
                </div>
              ) : null}
            </div>
          </div>

          <ConvertToProjectButton
            workspaceSlug={params.workspace}
            dealId={deal.id}
            convertedProjectId={deal.convertedProject?.id ?? null}
            convertedProjectName={deal.convertedProject?.name ?? null}
          />
          <Button variant="secondary" fullWidth>Edit deal</Button>
        </div>
      </div>

      <div className="mt-7">
        <a href={`/w/${params.workspace}/deals`} className="text-xs text-ink-50 hover:text-ink">
          ← Back to all deals
        </a>
      </div>
    </div>
  );
}
