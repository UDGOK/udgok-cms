import { prisma } from '@/lib/db/client';

export async function listWorkspaceFiles(workspaceId: string, take = 100) {
  return prisma.file.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      uploader: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
}
