import { prisma } from '@/lib/db/client';

export async function listProjects(workspaceId: string, take = 100) {
  return prisma.project.findMany({
    where: { workspaceId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take,
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { divisions: true, payApps: true, tasks: true } },
    },
  });
}

export async function getProject(workspaceId: string, id: string) {
  return prisma.project.findFirst({
    where: { id, workspaceId },
    include: {
      client: true,
      members: { include: { user: true } },
      divisions: { orderBy: { sortOrder: 'asc' } },
      payApps: {
        orderBy: { drawNumber: 'desc' },
        include: { divisions: true },
      },
      tasks: { where: { status: { not: 'DONE' } }, take: 10 },
    },
  });
}
