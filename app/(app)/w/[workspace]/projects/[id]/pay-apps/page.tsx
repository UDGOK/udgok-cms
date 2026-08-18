import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { PageHeader } from '@/components/ui/PageHeader';
import { GeneratePayAppButton } from '../GeneratePayAppButton';
import { ProjectTabsBar } from '../ProjectTabsBar';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-30 text-ink',
  SENT: 'bg-warning text-ink',
  VIEWED: 'bg-orange text-paper',
  ACKNOWLEDGED: 'bg-success text-paper',
  PAID: 'bg-success text-paper',
  DISPUTED: 'bg-error text-paper',
  CANCELLED: 'bg-ink-30 text-ink',
};

export default async function ProjectPayAppsPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: {
      payApps: {
        orderBy: { drawNumber: 'desc' },
        include: { divisions: true },
      },
      divisions: { select: { id: true } },
      _count: {
        select: { tasks: true, subAssignments: true },
      },
    },
  });
  if (!project) notFound();

  const projectMembersCount = await prisma.projectMember.count({
    where: { projectId: params.id },
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <MobilePageHeader
        title="Pay applications"
        subtitle={project.name}
        backHref={`/w/${params.workspace}/projects/${params.id}`}
        actionLabel="+ Generate"
        actionHref={`/w/${params.workspace}/projects/${project.id}/pay-apps/new`}
        actionVariant="copper"
      />

      <div className="hidden md:block max-w-6xl">
        <PageHeader
          title="Pay applications"
          subtitle={`${project.name} · ${project.payApps.length} draw${project.payApps.length === 1 ? '' : 's'} issued`}
        />
      </div>

      <ProjectTabsBar
        workspaceSlug={params.workspace}
        projectId={project.id}
        taskCount={project._count.tasks}
        payAppCount={project.payApps.length}
        subAssignmentCount={project._count.subAssignments}
        teamMemberCount={projectMembersCount}
      />

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-[13px] text-ink-70">
          Each draw is a pay application sent to the client. Track when they open it, when they sign, and when it&apos;s paid.
        </p>
        <GeneratePayAppButton
          workspaceSlug={params.workspace}
          projectId={project.id}
          hasDivisions={project.divisions.length > 0}
        />
      </div>

      {project.payApps.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center">
          <div className="text-2xl mb-3">💰</div>
          <p className="text-ink-70 mb-4">No pay apps yet. Generate the first draw once you have at least one SOV division.</p>
          <Link
            href={`/w/${params.workspace}/projects/${project.id}/pay-apps/new`}
            className="inline-block px-5 py-3 bg-orange text-paper border-2 border-orange font-extrabold uppercase tracking-[0.12em] text-xs"
          >
            + Generate the first pay app
          </Link>
        </div>
      ) : (
        <div className="bg-paper border-2 border-line">
          <div className="hidden md:grid grid-cols-[80px_1fr_140px_140px_140px_140px_60px] gap-3 px-5 py-3 border-b-2 border-ink bg-cream-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
            <div>DRAW</div>
            <div>PERIOD</div>
            <div className="text-right">CONTRACT</div>
            <div className="text-right">PREVIOUS</div>
            <div className="text-right">THIS DRAW</div>
            <div className="text-right">BALANCE</div>
            <div></div>
          </div>
          {project.payApps.map((p) => (
            <Link
              key={p.id}
              href={`/w/${params.workspace}/projects/${project.id}/pay-apps/${p.id}`}
              className="block md:grid md:grid-cols-[80px_1fr_140px_140px_140px_140px_60px] gap-3 px-5 py-3.5 border-b border-line-soft last:border-0 items-center hover:bg-cream-2"
            >
              <div className="font-mono text-[14px] font-black text-orange-d">#{p.drawNumber}</div>
              <div className="min-w-0">
                <div className="font-extrabold text-[13px]">
                  {p.periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {p.periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em] flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 py-0.5 ${STATUS_COLOR[p.status] ?? 'bg-ink-30 text-ink'}`}>
                    {p.status}
                  </span>
                  {p.viewCount > 0 ? `· ${p.viewCount} view${p.viewCount === 1 ? '' : 's'}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em] md:hidden">CONTRACT</div>
                <div className="font-extrabold text-[13px]">${Number(p.totalContract).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em] md:hidden">PREVIOUS</div>
                <div className="font-extrabold text-[13px]">${Number(p.totalPrevious).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em] md:hidden">THIS DRAW</div>
                <div className="font-black text-[15px] text-orange-d">${Number(p.totalThisDraw).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em] md:hidden">BALANCE</div>
                <div className="font-extrabold text-[13px]">${Number(p.totalBalance).toLocaleString()}</div>
              </div>
              <div className="text-right text-ink-50 hidden md:block">→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
