import { prisma } from '@/lib/db/client';
import { cache } from 'react';

export const getWorkspace = cache(async (slug: string) => {
  const ws = await prisma.workspace.findUnique({ where: { slug } });
  if (!ws) {
    throw new Error(`Workspace not found: ${slug}`);
  }
  return ws;
});
