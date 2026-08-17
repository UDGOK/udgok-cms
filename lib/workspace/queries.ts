import { prisma } from '@/lib/db/client';

export interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
  role: string;
}

export async function listUserWorkspaces(userId: string): Promise<WorkspaceOption[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, slug: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    name: m.workspace.name,
    role: m.role,
  }));
}
