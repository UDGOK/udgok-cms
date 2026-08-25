import { notFound } from 'next/navigation';
import { getDeal } from '@/lib/deals/queries';
import { DEAL_STAGE_LABELS, DEAL_STAGES, type DealStage } from '@/lib/deals/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { StatusBadge } from '@/components/ui';
import { prisma } from '@/lib/db/client';
import { ConvertToProjectButton } from './ConvertToProjectButton';
import { EditDealButton } from './EditDealButton';
import { AddNoteForm } from './AddNoteForm';
import { fmtDate } from '@/lib/format/currency';

export default async function DealDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const deal = await getDeal(workspace.id, params.id);
  if (!deal) notFound();

  // Pull the property list so the edit modal can show a
  // dropdown of available properties. We only fetch active
  // ones to avoid offering a deal a property that has been
  // retired. Cheap query — list is small.
  const properties = await prisma.property.findMany({
    where: { client: { workspaceId: workspace.id, status: 'ACTIVE' } },
    orderBy: { label: 'asc' },
    select: { id: true, label: true },
  });

  const stage: DealStage = deal.stage as DealStage;
  const stageIdx = DEAL_STAGES.indexOf(stage);
  const isClosed = stage === 'WON' || stage === 'LOST';

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
            {deal.client.name} · {deal.property ? deal.property.label : 'No property'} · CREATED {fmtDate(deal.createdAt)}
            {deal.closedAt ? ` · CLOSED ${fmtDate(deal.closedAt)}` : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge
            status={
              stage === 'WON'
                ? 'active'
                : stage === 'LOST'
                  ? 'inactive'
                  : 'in_progress'
            }
          />
          <div className="text-2xl font-black">${Number(deal.value).toLocaleString()}</div>
          {deal.margin ? (
            <div className="text-[11px] text-ink-50">Margin: {deal.margin}%</div>
          ) : null}
        </div>
      </div>

      {/* Stage rail — the visual pipeline you saw in the screenshot.
          Active stage is orange, past stages are dark, future stages
          are muted. WON/LOST get a small badge. */}
      <div className="bg-paper border border-line p-5 mb-6">
        <div className="label-eyebrow mb-3">{'// Pipeline'}</div>
        <div className="grid grid-cols-6 gap-2">
          {DEAL_STAGES.map((s, i) => {
            const isActive = i === stageIdx;
            const isPast = i < stageIdx;
            const isTerminal = s === 'WON' || s === 'LOST';
            return (
              <div
                key={s}
                className={`p-3 text-center ${
                  isActive
                    ? isTerminal
                      ? s === 'WON'
                        ? 'bg-success text-paper'
                        : 'bg-error text-paper'
                      : 'bg-orange text-paper'
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
        <div className="text-[10px] text-ink-50 mt-3 font-mono">
          Drag the card on the kanban to move between the four open
          stages. Use the buttons in the sidebar to mark as
          <span className="text-success font-extrabold"> won</span> or
          <span className="text-error font-extrabold"> lost</span>.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Notes / activity feed */}
        <div className="md:col-span-2 bg-paper border border-line p-6">
          <div className="label-eyebrow mb-4">{'// Activity'}</div>
          {deal.notes.length === 0 ? (
            <p className="text-ink-50 text-sm">
              No notes yet. Add one below to start the conversation.
            </p>
          ) : (
            <div className="space-y-4">
              {deal.notes.map((n) => (
                <div
                  key={n.id}
                  className="pb-4 border-b border-line-soft last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-ink text-cream flex items-center justify-center font-black text-xs">
                      {(n.author?.name ?? '?')
                        .split(' ')
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div>
                      <div className="font-extrabold text-[13px]">
                        {n.author?.name ?? 'Unknown'}
                      </div>
                      <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em]">
                        {fmtDate(n.createdAt)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] text-ink-70 mt-2 whitespace-pre-line">
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          <AddNoteForm
            workspaceSlug={params.workspace}
            dealId={deal.id}
          />
        </div>

        {/* Sidebar — actions */}
        <div className="space-y-3">
          <div className="bg-paper border border-line p-5">
            <div className="label-eyebrow mb-3">{'// Details'}</div>
            <div className="space-y-3 text-[13px]">
              <div>
                <div className="label-mono">VALUE</div>
                <div className="font-black text-lg">
                  ${Number(deal.value).toLocaleString()}
                </div>
              </div>
              {deal.expectedClose ? (
                <div>
                  <div className="label-mono">EXPECTED CLOSE</div>
                  <div className="font-extrabold">
                    {fmtDate(deal.expectedClose)}
                  </div>
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
                  <div className="text-ink-70 whitespace-pre-line">
                    {deal.description}
                  </div>
                </div>
              ) : null}
              {deal.fitScore ? (
                <div>
                  <div className="label-mono">FIT SCORE</div>
                  <div className="font-extrabold">{deal.fitScore}/100</div>
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

          <EditDealButton
            workspaceSlug={params.workspace}
            dealId={deal.id}
            initial={{
              title: deal.title,
              value: Number(deal.value),
              margin: deal.margin ?? null,
              expectedClose: deal.expectedClose
                ? new Date(deal.expectedClose).toISOString()
                : null,
              description: deal.description ?? null,
              propertyId: deal.property?.id ?? null,
            }}
            properties={properties}
            currentStage={stage}
          />

          {isClosed ? (
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 text-center pt-1">
              This deal is {stage.toLowerCase()}. Reopen to edit
              the description or move it back into the pipeline.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-7">
        <a
          href={`/w/${params.workspace}/deals`}
          className="text-xs text-ink-50 hover:text-ink"
        >
          ← Back to all deals
        </a>
      </div>
    </div>
  );
}
