import { prisma } from '@/lib/db/client';

export async function listProjectPhotoFolders(projectId: string) {
  return prisma.projectPhotoFolder.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { photos: true } },
    },
  });
}

/**
 * Seed a project's photo folders with a sensible default set
 * (Before, In Progress, Punch List, Final). Idempotent — only
 * creates ones that don't already exist by name.
 */
export async function seedDefaultPhotoFolders(projectId: string, workspaceId: string) {
  const defaults = [
    { name: 'Before', color: 'ink-30', sortOrder: 0, description: 'Site / demo / pre-construction' },
    { name: 'In Progress', color: 'orange', sortOrder: 1, description: 'Active work in progress' },
    { name: 'Punch List', color: 'warning', sortOrder: 2, description: 'Items to fix before final' },
    { name: 'Final', color: 'success', sortOrder: 3, description: 'Completed work, post-final' },
  ];

  for (const def of defaults) {
    await prisma.projectPhotoFolder.upsert({
      where: { projectId_name: { projectId, name: def.name } },
      update: {},
      create: {
        projectId,
        workspaceId,
        name: def.name,
        color: def.color,
        sortOrder: def.sortOrder,
        description: def.description,
      },
    });
  }
}
