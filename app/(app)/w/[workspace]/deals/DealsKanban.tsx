'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { DEAL_STAGE_LABELS, DEAL_STAGES, type DealStage } from '@/lib/deals/queries';
import { moveDealStage } from './actions';
import { NewDealModal } from './NewDealModal';

interface ClientRef { id: string; name: string }

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  client: ClientRef;
}

interface DealsKanbanProps {
  workspaceSlug: string;
  clients: ClientRef[];
  initialDeals: Deal[];
}

const PIPELINE_STAGES: DealStage[] = ['LEAD', 'CONTACTED', 'ESTIMATE_SENT', 'NEGOTIATING'];

export function DealsKanban({ workspaceSlug, clients, initialDeals }: DealsKanbanProps) {
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();

  const grouped = DEAL_STAGES.reduce<Record<DealStage, Deal[]>>(
    (acc, s) => {
      acc[s] = initialDeals.filter((d) => d.stage === s);
      return acc;
    },
    { LEAD: [], CONTACTED: [], ESTIMATE_SENT: [], NEGOTIATING: [], WON: [], LOST: [] },
  );

  async function handleDrop(e: React.DragEvent, stage: DealStage) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/deal-id');
    if (!dealId) return;
    await moveDealStage(dealId, stage);
    router.refresh();
  }

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-4 gap-4 min-w-[1100px]">
          {PIPELINE_STAGES.map((stage) => {
            const deals = grouped[stage];
            const totalValue = deals.reduce((acc, d) => acc + d.value, 0);
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, stage)}
                className="bg-cream-2 border border-line min-h-[600px] flex flex-col"
              >
                <div className="p-4 border-b border-line bg-paper">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-extrabold uppercase text-[11px] tracking-[0.12em]">
                      {DEAL_STAGE_LABELS[stage]}
                    </div>
                    <div className="font-black text-xs text-orange-d">
                      ${totalValue.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[10px] text-ink-50 font-mono">
                    {deals.length} deal{deals.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="p-3 space-y-3 flex-1">
                  {deals.length === 0 ? (
                    <div className="text-center text-ink-50 text-xs py-12 border-2 border-dashed border-line">
                      Drop deals here
                    </div>
                  ) : (
                    deals.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/deal-id', d.id)}
                        onClick={() => router.push(`/w/${workspaceSlug}/deals/${d.id}`)}
                        className="bg-paper border border-line p-4 cursor-pointer hover:border-ink transition-colors"
                      >
                        <div className="text-[9px] font-mono text-ink-50 tracking-[0.1em] uppercase mb-1.5">
                          {d.client.name}
                        </div>
                        <div className="font-extrabold text-[14px] leading-snug mb-2.5">
                          {d.title}
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-[9px] font-mono text-ink-50 tracking-[0.1em] uppercase">
                              VALUE
                            </div>
                            <div className="font-black text-lg leading-tight">
                              ${d.value.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button variant="copper" onClick={() => setShowNew(true)}>
        + New deal
      </Button>

      {showNew ? (
        <NewDealModal
          workspaceSlug={workspaceSlug}
          clients={clients}
          onClose={() => setShowNew(false)}
        />
      ) : null}
    </>
  );
}
