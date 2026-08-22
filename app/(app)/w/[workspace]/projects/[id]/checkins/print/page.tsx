import { notFound } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { listCheckInCodesForProject } from '@/lib/checkins/queries';
import { PrintableCheckInSheet } from '@/lib/checkins/printable';

export const dynamic = 'force-dynamic';

/**
 * Print-friendly sheet of QR codes for a project. Renders
 * the entire view as the print target (no chrome, no
 * sidebar) so the user can hit Cmd+P / Ctrl+P and get
 * a clean printout.
 *
 * Renders ALL codes for the project (active + retired)
 * so the admin can see what's still in use. Retired
 * codes are visually marked.
 */
export default async function ProjectCheckInPrintPage({
  params,
}: {
  params: { workspace: string; projectId: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, workspaceId: workspace.id },
    select: { id: true, name: true, code: true },
  });
  if (!project) notFound();

  const codes = await listCheckInCodesForProject(project.id);

  // The printable view is meant to be self-contained,
  // so we DON'T wrap it in the (app) layout. We use
  // a separate route for the print, and the link in
  // the per-project page uses target="_blank" so the
  // admin doesn't lose their place in the admin UI.
  return (
    <PrintableCheckInSheet
      projectName={project.name}
      projectCode={project.code}
      codes={codes}
      workspaceName={workspace.name}
    />
  );
}
