/**
 * Project Submittals list page.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { listSubmittals } from '@/lib/submittals/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { SubmittalsTable } from './SubmittalsTable';
import { NewSubmittalButton } from './NewSubmittalButton';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-30 text-ink',
  SUBMITTED: 'bg-warning text-ink',
  UNDER_REVIEW: 'bg-warning text-ink',
  FORWARDED: 'bg-warning text-ink',
  APPROVED: 'bg-success text-paper',
  APPROVED_AS_NOTED: 'bg-success text-paper',
  REVISE_AND_RESUBMIT: 'bg-orange text-paper',
  REJECTED: 'bg-error text-paper',
  VOID: 'bg-ink-30 text-ink',
};

export default async function ProjectSubmittalsPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const submittals = await listSubmittals(project.id, workspace.id);
  const subs = await prisma.subcontractor.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const open = submittals.filter(
    (s) =>
      s.status === 'SUBMITTED' ||
      s.status === 'UNDER_REVIEW' ||
      s.status === 'FORWARDED' ||
      s.status === 'REVISE_AND_RESUBMIT',
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submittals"
        subtitle="Shop drawings, product data, and samples — reviewed by GC and architect"
        breadcrumbs={[
          { label: project.name, href: `/w/${params.workspace}/projects/${params.id}` },
          { label: 'Submittals' },
        ]}
        actions={
          <NewSubmittalButton
            projectId={project.id}
            workspaceSlug={params.workspace}
            subcontractorOptions={subs}
          />
        }
      />
      <MobilePageHeader title="Submittals" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Total submittals</div>
          <div className="text-2xl font-extrabold tabular-nums">{submittals.length}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Open in review</div>
          <div className={`text-2xl font-extrabold tabular-nums ${open > 0 ? 'text-warning' : ''}`}>{open}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Approved</div>
          <div className="text-2xl font-extrabold tabular-nums">
            {submittals.filter((s) => s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED').length}
          </div>
        </div>
      </div>

      <SubmittalsTable
        submittals={submittals}
        workspaceSlug={params.workspace}
        projectId={project.id}
        statusColor={STATUS_COLOR}
      />

      {submittals.length === 0 ? (
        <div className="bg-paper border-2 border-dashed border-ink-30 p-8 text-center">
          <h3 className="font-bold mb-2">No submittals yet</h3>
          <p className="text-ink-70 text-sm mb-4">
            Submittals organize every shop drawing, product data sheet, and
            sample by CSI spec section. The architect/engineer reviews them
            from a public link — no login required.
          </p>
          <NewSubmittalButton
            projectId={project.id}
            workspaceSlug={params.workspace}
            subcontractorOptions={subs}
            primary
          />
        </div>
      ) : null}
    </div>
  );
}
