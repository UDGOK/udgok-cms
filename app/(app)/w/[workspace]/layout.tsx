import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { Sidebar } from '@/components/workspace/Sidebar';
import { Topbar } from '@/components/workspace/Topbar';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceContext';
import { PresenceShell } from '@/components/workspace/PresenceShell';

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
    // User is signed in but not a member of this workspace.
    // Send them to the switcher so they can pick one they belong to.
    redirect('/workspaces');
  }

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
        <div className="flex min-h-screen bg-cream">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </PresenceShell>
    </WorkspaceProvider>
  );
}
