import { prisma } from '@/lib/db/client';

/**
 * Returns the workspaces the given user is a member of, ordered by most
 * recently joined. The DB call is cheap (one indexed query) and safe to
 * call from any server component.
 */
export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}
