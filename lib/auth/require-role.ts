import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'PM' | 'ESTIMATOR' | 'FIELD' | 'MEMBER';
  email: string;
  name: string | null;
}

/**
 * Wraps Clerk's auth() + DB membership lookup with error handling.
 * Throws AuthError(401) if not signed in, AuthError(403) if not in workspace.
 * Wrapped in try/catch so a misconfigured Clerk setup doesn't 500 every page —
 * we propagate a clean 401 that callers (or layouts) can convert to a redirect.
 */
export async function getAuthContext(workspaceSlug: string): Promise<AuthContext> {
  let userId: string | null = null;
  let email: string | null = null;
  let name: string | null = null;

  try {
    const a = await auth();
    userId = a.userId;
    if (userId) {
      try {
        const u = await currentUser();
        if (u) {
          email = u.emailAddresses[0]?.emailAddress ?? null;
          name = [u.firstName, u.lastName].filter(Boolean).join(' ') || null;
        }
      } catch {
        // ignore — currentUser() can fail with key mismatch
      }
    }
  } catch (e) {
    console.error('[getAuthContext] Clerk auth() failed', e);
    throw new AuthError('Authentication service unavailable', 503);
  }

  if (!userId) {
    throw new AuthError('Not signed in', 401);
  }

  // Ensure the user exists in our DB (best-effort upsert)
  try {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: email ?? `${userId}@unknown.local`,
        name,
      },
      update: {
        email: email ?? undefined,
        name: name ?? undefined,
      },
    });
  } catch (e) {
    console.error('[getAuthContext] user upsert failed', e);
    // Don't fail the whole request — they might still be in a workspace
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    throw new AuthError('Workspace not found', 404);
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
  });
  if (!membership) {
    throw new AuthError('Not a member of this workspace', 403);
  }

  return {
    userId,
    workspaceId: workspace.id,
    role: membership.role,
    email: email ?? '',
    name,
  };
}

export type Role = AuthContext['role'];

/**
 * Wrapped version of requireRole that uses getAuthContext.
 * Throws AuthError on failure.
 */
export async function requireRole(
  workspaceIdOrSlug: string,
  allowed: Role[],
): Promise<AuthContext> {
  // workspaceIdOrSlug can be either an ID (org_* from Clerk) or a slug.
  // We resolve to slug first for getAuthContext.
  let slug = workspaceIdOrSlug;
  // If it looks like a Clerk org ID (starts with 'org_'), we can't resolve
  // a slug from it without an extra query — caller should pass a slug.
  if (slug.startsWith('org_')) {
    const ws = await prisma.workspace.findUnique({ where: { id: slug } });
    if (!ws) throw new AuthError('Workspace not found', 404);
    slug = ws.slug;
  }

  const ctx = await getAuthContext(slug);
  if (!allowed.includes(ctx.role)) {
    throw new AuthError(`Role ${ctx.role} not allowed (need one of: ${allowed.join(', ')})`, 403);
  }
  return ctx;
}

export async function getCurrentUser() {
  try {
    const { userId } = await auth();
    if (!userId) return null;
    return prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

export async function getWorkspaceRole(workspaceIdOrSlug: string): Promise<Role | null> {
  try {
    const ctx = await getAuthContext(
      workspaceIdOrSlug.startsWith('org_')
        ? (await prisma.workspace.findUnique({ where: { id: workspaceIdOrSlug } }))?.slug ?? workspaceIdOrSlug
        : workspaceIdOrSlug,
    );
    return ctx.role;
  } catch {
    return null;
  }
}
