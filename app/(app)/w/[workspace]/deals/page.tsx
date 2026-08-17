import { prisma } from '@/lib/db/client';
import { listDealsByStage, dealPipelineStats } from '@/lib/deals/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { DealsKanban } from './DealsKanban';

export default async function DealsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const [deals, clients, stats] = await Promise.all([
    listDealsByStage(workspace.id),
    prisma.client.findMany({
      where: { workspaceId: workspace.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    dealPipelineStats(workspace.id),
  ]);

  const weightedPipeline = ['LEAD', 'CONTACTED', 'ESTIMATE_SENT', 'NEGOTIATING']
    .reduce((acc, s) => acc + stats[s as keyof typeof stats].value, 0);
  const wonValue = stats.WON.value;
  const openCount = ['LEAD', 'CONTACTED', 'ESTIMATE_SENT', 'NEGOTIATING']
    .reduce((acc, s) => acc + stats[s as keyof typeof stats].count, 0);

  return (
    <div className="p-8">
      <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          4
        </span>
        Deals
      </div>
      <h1 className="text-display-lg mb-4">
        The <span className="font-serif italic text-orange-d">pipeline,</span> the way you actually think.
      </h1>

      <div className="grid grid-cols-3 gap-4 mb-7 max-w-2xl">
        <div className="bg-paper border border-line p-4">
          <div className="label-mono">Open Pipeline</div>
          <div className="font-black text-2xl">${weightedPipeline.toLocaleString()}</div>
        </div>
        <div className="bg-paper border border-line p-4">
          <div className="label-mono">Won (All-time)</div>
          <div className="font-black text-2xl text-success">${wonValue.toLocaleString()}</div>
        </div>
        <div className="bg-paper border border-line p-4">
          <div className="label-mono">Open Deals</div>
          <div className="font-black text-2xl">{openCount}</div>
        </div>
      </div>

      <DealsKanban
        workspaceSlug={params.workspace}
        clients={clients}
        initialDeals={deals.map((d) => ({
          id: d.id,
          title: d.title,
          value: Number(d.value),
          stage: d.stage as 'LEAD' | 'CONTACTED' | 'ESTIMATE_SENT' | 'NEGOTIATING' | 'WON' | 'LOST',
          client: d.client,
        }))}
      />
    </div>
  );
}
