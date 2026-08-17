import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Sidebar } from '@/components/workspace/Sidebar';
import { Topbar } from '@/components/workspace/Topbar';
import { prisma } from '@/lib/db/client';

/**
 * Authenticated app shell. The Clerk middleware already ensures only signed-in
 * users reach here. This layout:
 *  - Verifies the user has at least one Workspace (membership)
 *  - Redirects to /workspaces if not
 *  - Resolves the active workspace from Clerk's auth().orgId
 *  - Renders Sidebar + Topbar + children
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  // Fetch the active workspace from our DB.
  // For now, the active workspace is the user's first membership (no UI switcher yet).
  // Task 11 will resolve workspace from the URL slug.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    // No workspace yet — send to onboarding/workspace switcher.
    redirect('/workspaces');
  }

  // If Clerk has an active org, prefer that one. Otherwise first membership.
  const activeMembership =
    user.memberships.find((m) => m.workspaceId === orgId) ?? user.memberships[0];
  const activeWorkspace = activeMembership.workspace;

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar workspaceSlug={activeWorkspace.slug} workspaceName={activeWorkspace.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar workspaceName={activeWorkspace.name} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
