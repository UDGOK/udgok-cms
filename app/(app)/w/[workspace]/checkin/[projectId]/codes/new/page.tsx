import { notFound } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { NewCheckInCodeForm } from './NewCheckInCodeForm';
import { listCheckInCodesForProject } from '@/lib/checkins/queries';
import { generateCheckInCodeAction } from '@/lib/checkins/actions';

export const dynamic = 'force-dynamic';

/**
 * Admin form: generate a new site check-in QR code for
 * a project. The form takes a single field (label) and
 * the server action handles the rest — generates a
 * 24-byte random token, persists the row, redirects
 * back to the project check-in page so the admin can
 * see + print the new sticker.
 */
export default async function NewCheckInCodePage({
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

  // We show the existing labels so the admin can pick
  // something that doesn't clash (label uniqueness is
  // not enforced at the DB level, but duplicate labels
  // would be confusing on the printed sheet).
  const existing = await listCheckInCodesForProject(project.id);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Generate check-in code"
        subtitle={`Create a new QR sticker for ${project.name}. Print the resulting page and stick it at the check-in point on site.`}
        breadcrumbs={[
          { label: workspace.name, href: `/w/${workspace.slug}` },
          { label: 'Check-in', href: `/w/${workspace.slug}/checkin` },
          { label: project.name, href: `/w/${workspace.slug}/checkin/${project.id}` },
          { label: 'New code' },
        ]}
      />

      <NewCheckInCodeForm
        workspaceSlug={workspace.slug}
        projectId={project.id}
        projectName={project.name}
        existingLabels={existing.map((c) => c.label)}
        action={generateCheckInCodeAction}
      />
    </div>
  );
}
