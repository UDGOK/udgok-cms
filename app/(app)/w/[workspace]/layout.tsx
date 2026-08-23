/**
 * Workspace layout — wraps every page under /w/[ws]/* with
 * the sidebar + topbar + global app shell. The actual page
 * content comes in as `children`.
 */
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { Sidebar } from '@/components/workspace/Sidebar';
import { TopbarWithDrawer } from '@/components/workspace/TopbarWithDrawer';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceContext';
import { PresenceShell } from '@/components/workspace/PresenceShell';
import { MobileShellClient } from '@/components/workspace/MobileShellClient';
import { AppFooter } from '@/components/workspace/AppFooter';
import { TrialBanner } from '@/components/workspace/TrialBanner';
import { ClockSkewIndicator } from '@/components/ClockSkewIndicator';
import { isMasterAdmin } from '@/lib/admin/permissions';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspace: string };
}) {
  // TEMPORARY DEBUG: surface actual error inline. No useEffect,
  // no fetch. Renders the real error.message in JSX so the
  // user can see what's actually breaking.
  let layoutError: { name: string; message: string; stack: string | null } | null = null;
  let userId: string | null = null;
  let workspace: Awaited<ReturnType<typeof prisma.workspace.findUnique>> = null;
  let membership: Awaited<ReturnType<typeof prisma.membership.findUnique>> = null;
  let currentUser: { timezone: string | null } | null = null;
  let allWorkspaces: Array<{ id: string; slug: string; name: string; role: string }> = [];
  let members: Array<{ id: string; name: string; role: string }> = [];
  let master = false;

  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) redirect('/sign-in');

    workspace = await prisma.workspace.findUnique({ where: { slug: params.workspace } });
    if (!workspace) notFound();

    const [m, cu] = await Promise.all([
      prisma.membership.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      }),
    ]);
    membership = m;
    currentUser = cu;
    if (!membership) redirect('/workspaces');

    const allMemberships = await prisma.membership.findMany({
      where: { userId },
      include: { workspace: { select: { id: true, slug: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    allWorkspaces = allMemberships.map((mm) => ({
      id: mm.workspace.id,
      slug: mm.workspace.slug,
      name: mm.workspace.name,
      role: mm.role,
    }));

    const memberRows = await prisma.membership.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    members = memberRows.map((mr) => ({
      id: mr.user.id,
      name: mr.user.name ?? mr.user.email,
      role: mr.role,
    }));

    master = await isMasterAdmin(userId);
  } catch (e) {
    layoutError = {
      name: e instanceof Error ? e.name : 'Unknown',
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    };
  }

  if (layoutError) {
    return (
      <div className="p-6 bg-cream min-h-screen">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-error mb-3">
          {'// Workspace layout data error'}
        </div>
        <h1 className="text-xl font-black mb-3">Layout failed to load.</h1>
        <pre className="bg-paper border-2 border-error p-3 text-xs font-mono whitespace-pre-wrap break-words text-ink">
          <strong>ERROR:</strong> {layoutError.name}: {layoutError.message}
          {'\n\n'}
          <strong>STACK:</strong>
          {'\n'}
          {layoutError.stack}
        </pre>
      </div>
    );
  }

  if (!userId || !workspace || !membership || !currentUser) {
    return <div>Workspace not found</div>;
  }

  // TEMPORARY DEBUG: catch errors during JSX render. The data
  // fetch is wrapped above; this catches client-component
  // errors during the SSR pass. Without this, a bug in any
  // rendered client component (Sidebar, Topbar, TrialBanner,
  // ClockSkewIndicator, etc.) throws and the error boundary
  // catches the masked message — we'd never see the real one.
  let renderError: { name: string; message: string; stack: string | null } | null = null;
  let rendered: React.ReactNode = null;
  try {
    rendered = (() => {
      const t = Date.now();
      return (
        <WorkspaceProvider
          value={{
            id: workspace.id,
            slug: workspace.slug,
            name: workspace.name,
            role: membership.role,
            timezone: currentUser.timezone ?? 'UTC',
          }}
        >
          <PresenceShell workspaceId={workspace.id}>
            <MobileShellClient
              workspaceId={workspace.id}
              allWorkspaces={allWorkspaces}
              isMasterAdmin={master}
            >
              <div
                id="server-now"
                data-server-now={t}
                aria-hidden="true"
                className="hidden"
              />
              <div className="flex min-h-screen bg-cream">
                <div className="hidden md:flex">
                  <Sidebar />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <TrialBanner
                    workspaceSlug={workspace.slug}
                    plan={workspace.plan}
                    trialEndsAt={workspace.trialEndsAt}
                  />
                  <ClockSkewIndicator />
                  <TopbarWithDrawer
                    allWorkspaces={allWorkspaces}
                    isMasterAdmin={master}
                    members={members}
                  />
                  <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
                  <AppFooter />
                </div>
              </div>
            </MobileShellClient>
          </PresenceShell>
        </WorkspaceProvider>
      );
    })();
  } catch (e) {
    renderError = {
      name: e instanceof Error ? e.name : 'Unknown',
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    };
  }

  if (renderError) {
    return (
      <div className="p-6 bg-cream min-h-screen">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-error mb-3">
          {'// Workspace layout render error'}
        </div>
        <h1 className="text-xl font-black mb-3">Layout render failed.</h1>
        <pre className="bg-paper border-2 border-error p-3 text-xs font-mono whitespace-pre-wrap break-words text-ink">
          <strong>ERROR:</strong> {renderError.name}: {renderError.message}
          {'\n\n'}
          <strong>STACK:</strong>
          {'\n'}
          {renderError.stack}
        </pre>
      </div>
    );
  }

  return rendered;
}
