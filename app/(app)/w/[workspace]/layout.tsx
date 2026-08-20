import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { Sidebar } from '@/components/workspace/Sidebar';
import { TopbarWithDrawer } from '@/components/workspace/TopbarWithDrawer';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceContext';
import { PresenceShell } from '@/components/workspace/PresenceShell';
import { MobileShellClient } from '@/components/workspace/MobileShellClient';
import { AppFooter } from '@/components/workspace/AppFooter';
import { isMasterAdmin } from '@/lib/admin/permissions';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspace: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Find the workspace by slug.
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
  });
  if (!workspace) notFound();

  // Verify the user is a member.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
  });
  if (!membership) {
    redirect('/workspaces');
  }

  // Load all workspaces the user belongs to, for the topbar switcher
  const allMemberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, slug: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  const allWorkspaces = allMemberships.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    name: m.workspace.name,
    role: m.role,
  }));

  // Master admin check — the platform owner (yasir@udgok.com) gets
  // an "Admin" button in the topbar and bypasses all plan gates.
  const master = await isMasterAdmin(userId);

  return (
    <WorkspaceProvider
      value={{
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        role: membership.role,
      }}
    >
      <PresenceShell workspaceId={workspace.id}>
        <MobileShellClient
          workspaceId={workspace.id}
          allWorkspaces={allWorkspaces}
          isMasterAdmin={master}
        >
          <div className="flex min-h-screen bg-cream">
            {/* Desktop sidebar — hidden on mobile (md:flex) */}
            <div className="hidden md:flex">
              <Sidebar />
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <TopbarWithDrawer allWorkspaces={allWorkspaces} isMasterAdmin={master} />
              {/* pb-16 on mobile to leave room for the bottom tab bar */}
              <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
              {/* Mini footer — desktop only. The mobile
                  bottom tab bar (rendered by MobileShellClient)
                  already serves as the visual ground on small
                  screens, and a 2-line footer would crowd it. */}
              <AppFooter />
            </div>
          </div>
        </MobileShellClient>
      </PresenceShell>
    </WorkspaceProvider>
  );
}
