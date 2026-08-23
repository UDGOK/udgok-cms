/**
 * Project RFI register page.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { listRfis } from '@/lib/submittals/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { RfisTable } from './RfisTable';
import { NewRfiButton } from './NewRfiButton';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-30 text-ink',
  SUBMITTED: 'bg-warning text-ink',
  ANSWERED: 'bg-success text-paper',
  VOID: 'bg-ink-30 text-ink',
};

export default async function ProjectRfisPage({
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

  const rfis = await listRfis(project.id, workspace.id);
  const open = rfis.filter((r) => r.status === 'SUBMITTED').length;
  const flaggedCost = rfis.filter((r) => r.costImpact && r.status === 'ANSWERED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFIs"
        subtitle="Request for Information — formal questions to architect/engineer"
        breadcrumbs={[
          { label: project.name, href: `/w/${params.workspace}/projects/${params.id}` },
          { label: 'RFIs' },
        ]}
        actions={<NewRfiButton projectId={project.id} workspaceSlug={params.workspace} />}
      />
      <MobilePageHeader title="RFIs" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Total RFIs</div>
          <div className="text-2xl font-extrabold tabular-nums">{rfis.length}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Awaiting response</div>
          <div className={`text-2xl font-extrabold tabular-nums ${open > 0 ? 'text-warning' : ''}`}>{open}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Cost-impact answers</div>
          <div className={`text-2xl font-extrabold tabular-nums ${flaggedCost > 0 ? 'text-orange' : ''}`}>
            {flaggedCost}
          </div>
        </div>
      </div>

      <RfisTable rfis={rfis} workspaceSlug={params.workspace} projectId={project.id} statusColor={STATUS_COLOR} />

      {rfis.length === 0 ? (
        <div className="bg-paper border-2 border-dashed border-ink-30 p-8 text-center">
          <h3 className="font-bold mb-2">No RFIs yet</h3>
          <p className="text-ink-70 text-sm mb-4">
            RFIs are the formal question-and-answer record between GC and
            architect/engineer. When an answer flags a cost or schedule
            change, you&apos;ll be prompted to start a Change Order.
          </p>
          <NewRfiButton projectId={project.id} workspaceSlug={params.workspace} primary />
        </div>
      ) : null}
    </div>
  );
}
