import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import type { Role } from '@prisma/client';

export class AuthError extends Error {
  constructor(
    public readonly code: 'UNAUTHENTICATED' | 'NO_WORKSPACE' | 'INSUFFICIENT_ROLE' | 'NOT_A_MEMBER',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Throws if the current user is not authenticated, has no active workspace,
 * is not a member of the active workspace, or their role is not in `allowed`.
 * Returns the user's id, role, and workspace id on success.
 */
export async function requireRole(
  workspaceId: string,
  allowed: Role[],
): Promise<{ userId: string; workspaceId: string; role: Role }> {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError('UNAUTHENTICATED', 'Not signed in');
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });

  if (!membership) {
    throw new AuthError('NOT_A_MEMBER', 'You are not a member of this workspace');
  }
  if (!allowed.includes(membership.role)) {
    throw new AuthError(
      'INSUFFICIENT_ROLE',
      `Role ${membership.role} not allowed (need one of: ${allowed.join(', ')})`,
    );
  }

  return { userId, workspaceId, role: membership.role };
}

/**
 * Returns the current user with their memberships, or null if not signed in.
 */
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
}

/**
 * Returns the user's role in the given workspace, or null if not a member.
 */
export async function getWorkspaceRole(
  userId: string,
  workspaceId: string,
): Promise<Role | null> {
  const m = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  return m?.role ?? null;
}
