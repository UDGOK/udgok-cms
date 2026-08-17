import { prisma } from '@/lib/db/client';

export async function getPayAppByShareToken(token: string) {
  return prisma.payApp.findUnique({
    where: { shareToken: token },
    include: {
      project: { include: { client: true } },
      divisions: {
        orderBy: { sortOrder: 'asc' },
        include: { projectDivision: true },
      },
      viewEvents: { orderBy: { viewedAt: 'desc' } },
    },
  });
}

export async function getPayApp(workspaceId: string, id: string) {
  // Need to find payApp via project.workspaceId
  return prisma.payApp.findFirst({
    where: { id, project: { workspaceId } },
    include: {
      project: { include: { client: true } },
      divisions: {
        orderBy: { sortOrder: 'asc' },
        include: { projectDivision: true },
      },
      viewEvents: { orderBy: { viewedAt: 'desc' }, take: 50 },
    },
  });
}
