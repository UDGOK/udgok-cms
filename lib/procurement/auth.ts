/**
 * Tenant scoping + role check for procurement routes.
 *
 * Mirrors lib/auth/require-role.ts but exposes a procurement-
 * specific error shape so the public vendor portal can return
 * 403/404 in the right format. The auth() call is also deferred
 * to inside the helper so it never runs at module import.
 *
 * Per spec §9.1: "Every query filters on workspaceId. Copy the
 * existing /api/presence pattern exactly — 403 {"error":"Not a
 * member"} for a foreign workspace, 400 for a missing param."
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Throws HttpError(401) if not signed in.
 * Throws HttpError(403) if not a member of the workspace.
 * Returns the member row so callers can do role checks.
 */
export async function assertMember(workspaceId: string) {
  const { userId } = await auth();
  if (!userId) throw new HttpError('Unauthorized', 401);
  const member = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true, role: true, userId: true },
  });
  if (!member) throw new HttpError('Not a member', 403);
  return member;
}

/** Require one of the given roles (OWNER, ADMIN, PM, FIELD,
 *  ESTIMATOR). Throws HttpError(403) if the user has a
 *  different role. */
export async function assertRole(
  workspaceId: string,
  allowed: Array<'OWNER' | 'ADMIN' | 'PM' | 'FIELD' | 'ESTIMATOR' | 'MEMBER'>,
) {
  const member = await assertMember(workspaceId);
  if (!allowed.includes(member.role as typeof allowed[number])) {
    throw new HttpError(
      `Role ${member.role} not allowed (need one of: ${allowed.join(', ')})`,
      403,
    );
  }
  return member;
}
