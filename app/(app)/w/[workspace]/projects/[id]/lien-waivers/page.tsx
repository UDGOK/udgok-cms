/**
 * Project Lien Waivers list page.
 *
 * Shows every waiver on the project. Four flavors per AIA
 * G901-G904 (conditional/unconditional × progress/final).
 * The user can create new waivers manually, or use the
 * "auto-create from pay app" flow (future enhancement).
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { listLienWaivers } from '@/lib/lien-waivers/queries';
import { LienWaiversTable } from './LienWaiversTable';
import { NewLienWaiverButton } from './NewLienWaiverButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-30 text-ink',
  SENT: 'bg-warning text-ink',
  VIEWED: 'bg-warning text-ink',
  SIGNED: 'bg-success text-paper',
  VOIDED: 'bg-ink-30 text-ink',
  REFUSED: 'bg-error text-paper',
  EXPIRED: 'bg-ink-30 text-ink',
};

const TYPE_LABEL: Record<string, string> = {
  CONDITIONAL_PROGRESS: 'Conditional progress',
  UNCONDITIONAL_PROGRESS: 'Unconditional progress',
  CONDITIONAL_FINAL: 'Conditional final',
  UNCONDITIONAL_FINAL: 'Unconditional final',
};

export default async function ProjectLienWaiversPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      payApps: { select: { id: true, drawNumber: true, periodEnd: true, totalThisDraw: true } },
    },
  });
  if (!project) notFound();

  const waivers = await listLienWaivers(project.id, workspace.id);
  const subs = await prisma.subcontractor.findMany({
    where: { workspaceId: workspace.id, assignments: { some: { projectId: project.id } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const unsignedFinal = waivers.filter(
    (w) => (w.type === 'CONDITIONAL_FINAL' || w.type === 'UNCONDITIONAL_FINAL') &&
      w.status !== 'SIGNED' && w.status !== 'VOIDED',
  ).length;
  const signedCount = waivers.filter((w) => w.status === 'SIGNED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lien Waivers"
        subtitle="Oklahoma Title 42 — release of mechanic's lien rights on receipt of payment"
        breadcrumbs={[
          { label: project.name, href: `/w/${params.workspace}/projects/${params.id}` },
          { label: 'Lien waivers' },
        ]}
        actions={
          <NewLienWaiverButton
            projectId={project.id}
            workspaceSlug={params.workspace}
            subcontractorOptions={subs}
            payAppOptions={project.payApps.map((p) => ({
              id: p.id,
              drawNumber: p.drawNumber,
              periodEnd: p.periodEnd.toISOString(),
              totalCents: Math.round(Number(p.totalThisDraw) * 100),
            }))}
          />
        }
      />
      <MobilePageHeader title="Lien Waivers" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Total waivers</div>
          <div className="text-2xl font-extrabold tabular-nums">{waivers.length}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Signed</div>
          <div className="text-2xl font-extrabold tabular-nums">{signedCount}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Unsigned final</div>
          <div className={`text-2xl font-extrabold tabular-nums ${unsignedFinal > 0 ? 'text-error' : ''}`}>
            {unsignedFinal}
          </div>
        </div>
      </div>

      <LienWaiversTable
        waivers={waivers}
        workspaceSlug={params.workspace}
        projectId={project.id}
        statusColor={STATUS_COLOR}
        typeLabel={TYPE_LABEL}
      />

      {waivers.length === 0 ? (
        <div className="bg-paper border-2 border-dashed border-ink-30 p-8 text-center">
          <h3 className="font-bold mb-2">No lien waivers yet</h3>
          <p className="text-ink-70 text-sm mb-4">
            Create waivers for each subcontractor and pay application. The signed
            waiver is your proof that the sub released their lien rights when
            they were paid — without it, your retainage release is exposed.
          </p>
          <NewLienWaiverButton
            projectId={project.id}
            workspaceSlug={params.workspace}
            subcontractorOptions={subs}
            payAppOptions={project.payApps.map((p) => ({
              id: p.id,
              drawNumber: p.drawNumber,
              periodEnd: p.periodEnd.toISOString(),
              totalCents: Math.round(Number(p.totalThisDraw) * 100),
            }))}
            primary
          />
        </div>
      ) : null}
    </div>
  );
}
