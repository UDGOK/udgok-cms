import { prisma } from '@/lib/db/client';

export const DEAL_STAGES = [
  'LEAD',
  'CONTACTED',
  'ESTIMATE_SENT',
  'NEGOTIATING',
  'WON',
  'LOST',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

const STAGE_LABELS: Record<DealStage, string> = {
  LEAD: 'New Lead',
  CONTACTED: 'Contacted',
  ESTIMATE_SENT: 'Estimate Sent',
  NEGOTIATING: 'Negotiating',
  WON: 'Won',
  LOST: 'Lost',
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = STAGE_LABELS;

export async function listDealsByStage(workspaceId: string) {
  const deals = await prisma.deal.findMany({
    where: { workspaceId, stage: { notIn: ['WON', 'LOST'] } },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, name: true } } },
  });
  return deals;
}

export async function listDealsWon(workspaceId: string, take = 20) {
  return prisma.deal.findMany({
    where: { workspaceId, stage: 'WON' },
    orderBy: { updatedAt: 'desc' },
    take,
    include: { client: { select: { id: true, name: true } } },
  });
}

export async function getDeal(workspaceId: string, id: string) {
  return prisma.deal.findFirst({
    where: { id, workspaceId },
    include: {
      client: true,
      property: true,
      notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      files: { orderBy: { createdAt: 'desc' } },
      tasks: { where: { status: { not: 'DONE' } }, take: 10 },
    },
  });
}

export async function dealPipelineStats(workspaceId: string) {
  const grouped = await prisma.deal.groupBy({
    by: ['stage'],
    where: { workspaceId },
    _count: true,
    _sum: { value: true },
  });
  return grouped.reduce<Record<DealStage, { count: number; value: number }>>(
    (acc, row) => {
      acc[row.stage as DealStage] = {
        count: row._count,
        value: Number(row._sum.value ?? 0),
      };
      return acc;
    },
    {
      LEAD: { count: 0, value: 0 },
      CONTACTED: { count: 0, value: 0 },
      ESTIMATE_SENT: { count: 0, value: 0 },
      NEGOTIATING: { count: 0, value: 0 },
      WON: { count: 0, value: 0 },
      LOST: { count: 0, value: 0 },
    },
  );
}
