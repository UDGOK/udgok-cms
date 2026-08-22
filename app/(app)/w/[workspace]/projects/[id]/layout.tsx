/**
 * Project layout — wraps every page under /w/[ws]/projects/[id]/*.
 *
 * Renders:
 *   - The vertical grouped sidebar (desktop, fixed left rail)
 *   - The mobile drawer trigger (hamburger in the page header)
 *   - The project mobile drawer (slide-in from the left on mobile)
 *   - The current page content (children)
 *
 * Replaces the old horizontal <ProjectTabs> tab bar. The sidebar
 * shows every section in 4 groups (Working / Schedule / Money /
 * Site) with live status badges.
 *
 * The big project header (name, status, completion ring, contract
 * value) is rendered per-page where needed — the layout only
 * provides the chrome. Sub-routes (photos, pay-apps, etc.) can
 * show their own page headers via <PageHeader> or
 * <MobilePageHeader>.
 */

import { notFound, redirect } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { getProjectSidebarStatus } from '@/lib/projects/sidebar-status';
import { ProjectMobileShell } from './_components/ProjectMobileShell';
import { ProjectLayoutChrome } from './_components/ProjectLayoutChrome';

interface LayoutProps {
  children: React.ReactNode;
  params: { workspace: string; id: string };
}

export const dynamic = 'force-dynamic';

export default async function ProjectLayout({ children, params }: LayoutProps) {
  let membership;
  try {
    membership = await requireMembership(params.workspace);
  } catch {
    redirect('/sign-in');
  }
  const { workspace } = membership;

  // Verify the project belongs to this workspace.
  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: { id: true, name: true, code: true },
  });
  if (!project) notFound();

  const status = await getProjectSidebarStatus(workspace.id, project.id);

  return (
    <ProjectMobileShell
      workspaceSlug={params.workspace}
      projectId={project.id}
      projectName={project.name}
      projectCode={project.code}
      badges={status.badges}
    >
      <ProjectLayoutChrome
        workspaceSlug={params.workspace}
        projectId={project.id}
        projectName={project.name}
        projectCode={project.code}
        badges={status.badges}
      >
        {children}
      </ProjectLayoutChrome>
    </ProjectMobileShell>
  );
}
