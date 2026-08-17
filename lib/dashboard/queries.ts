import { prisma } from '@/lib/db/client';

export async function workspaceDashboard(workspaceId: string) {
  const [activeClients, openDeals, wonDeals, activeProjects, openTasks] = await Promise.all([
    prisma.client.count({ where: { workspaceId, status: 'ACTIVE' } }),
    prisma.deal.count({ where: { workspaceId, stage: { notIn: ['WON', 'LOST'] } } }),
    prisma.deal.aggregate({
      where: { workspaceId, stage: 'WON' },
      _sum: { value: true },
      _count: true,
    }),
    prisma.project.count({ where: { workspaceId, status: 'ACTIVE' } }),
    prisma.task.count({ where: { workspaceId, status: { not: 'DONE' } } }),
  ]);

  return {
    activeClients,
    openDeals,
    wonValue: Number(wonDeals._sum.value ?? 0),
    wonCount: wonDeals._count,
    activeProjects,
    openTasks,
  };
}

export async function recentActivity(workspaceId: string, take = 10) {
  // Most recently created deals + clients as a unified stream
  const [deals, clients] = await Promise.all([
    prisma.deal.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take,
    }),
  ]);
  const items = [
    ...deals.map((d) => ({
      kind: 'deal' as const,
      id: d.id,
      at: d.createdAt,
      title: d.title,
      meta: `${d.client.name} · $${Number(d.value).toLocaleString()}`,
    })),
    ...clients.map((c) => ({
      kind: 'client' as const,
      id: c.id,
      at: c.createdAt,
      title: c.name,
      meta: c.email ?? '—',
    })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}
