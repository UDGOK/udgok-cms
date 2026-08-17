import { prisma } from '@/lib/db/client';

export async function getPayAppByShareToken(token: string) {
  const payApp = await prisma.payApp.findUnique({
    where: { shareToken: token },
    include: {
      project: { include: { client: true } },
      divisions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          projectDivision: {
            include: {
              subLinks: {
                take: 1,
                include: { assignment: { include: { subcontractor: true } } },
              },
            },
          },
        },
      },
      viewEvents: { orderBy: { viewedAt: 'desc' } },
    },
  });
  if (!payApp) return null;

  // All pay apps in this project, for the project-completion bar
  const allDraws = await prisma.payApp.findMany({
    where: { projectId: payApp.projectId },
    orderBy: { drawNumber: 'asc' },
    select: { drawNumber: true, totalThisDraw: true },
  });

  return { ...payApp, allDraws };
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
