import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';

export interface MembershipContext {
  userId: string;
  workspace: {
    id: string;
    slug: string;
    name: string;
    industry: string | null;
    createdAt: Date;
    plan: 'STARTER' | 'PRO' | 'ENTERPRISE';
  };
  membership: {
    id: string;
    role: 'OWNER' | 'ADMIN' | 'PM' | 'ESTIMATOR' | 'FIELD' | 'MEMBER';
  };
}

/**
 * For server components under app/(app)/w/[workspace]/* — verifies the
 * signed-in user is a member of the given workspace. Throws Next.js
 * notFound() / redirect() as appropriate so the caller doesn't have to
 * handle each case.
 *
 * Note: the (app)/w/[workspace]/layout.tsx already does this check, so
 * pages inside that route group can usually rely on the layout having
 * passed. This helper is for pages NOT under that layout (or for safety
 * double-checks).
 */
export async function requireMembership(
  workspaceSlug: string,
): Promise<MembershipContext> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, slug: true, name: true, industry: true, createdAt: true, plan: true },
  });
  if (!workspace) notFound();

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
    select: { id: true, role: true },
  });
  if (!membership) redirect('/workspaces');

  return { userId, workspace, membership };
}
