import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/lib/projects/queries';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { GanttChart, type GanttTask } from '@/components/workspace/GanttChart';
import { NewDivisionForm } from './NewDivisionForm';
import { GeneratePayAppButton } from './GeneratePayAppButton';
import { AssignSubForm } from './AssignSubForm';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { MessageThread } from '@/components/messages/MessageThread';
import { listMessagesForEntity } from '@/lib/messages/queries';
import { listEntityActivity } from '@/lib/activity/queries';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { countProjectPhotosByPhase } from '@/lib/photos/queries';

const SUB_STATUS_LABEL: Record<string, string> = {
  PROPOSED: 'Proposed',
  CONTRACTED: 'Contracted',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const SUB_STATUS_COLOR: Record<string, string> = {
  PROPOSED: 'bg-warning text-ink',
  CONTRACTED: 'bg-ink text-paper',
  ACTIVE: 'bg-success text-paper',
  COMPLETED: 'bg-ink-30 text-ink',
  CANCELLED: 'bg-line text-ink-50',
};

export default async function ProjectDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const { userId } = await auth();

  const [project, subs, messages, activity, photoCounts] = await Promise.all([
    getProject(workspace.id, params.id),
    prisma.subcontractor.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, primaryTrade: true },
    }),
    listMessagesForEntity('PROJECT', params.id, 50),
    listEntityActivity(workspace.id, 'project', params.id, 20),
    countProjectPhotosByPhase(params.id),
  ]);
  const totalPhotos = photoCounts.ROUGH_IN + photoCounts.FINAL;
  if (!project) notFound();

  const isAdmin =
    (await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: userId!, workspaceId: workspace.id } },
    }))?.role === 'OWNER' || (await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: userId!, workspaceId: workspace.id } },
    }))?.role === 'ADMIN';

  // Compute the SOV totals and remaining to bill
  const totalBudget = project.divisions.reduce((acc, d) => acc + Number(d.budget), 0);

  // Cumulative billed so far across all pay apps
  const totalBilled = project.payApps
    .filter((p) => p.status === 'PAID' || p.status === 'ACKNOWLEDGED' || p.status === 'VIEWED' || p.status === 'SENT')
    .reduce((acc, p) => acc + Number(p.totalThisDraw), 0);

  const remaining = (project.contractValue ? Number(project.contractValue) : totalBudget) - totalBilled;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <MobilePageHeader
        title={project.name}
        subtitle={`${project.code ?? 'PROJECT'} · ${project.client?.name ?? 'No client'}`}
        backHref={`/w/${params.workspace}/projects`}
        actionLabel="+ Pay app"
        actionHref={
          project.divisions.length > 0
            ? `/w/${params.workspace}/projects/${project.id}/pay-apps/new`
            : `/w/${params.workspace}/projects/${project.id}`
        }
        actionVariant="copper"
      />

      {/* Project nav tabs */}
      <div className="mt-4 flex items-center gap-1 border-b-2 border-line overflow-x-auto">
        <ProjectTab href={`/w/${params.workspace}/projects/${project.id}`} label="Overview" currentPath={`/w/${params.workspace}/projects/${project.id}`} />
        <ProjectTab
          href={`/w/${params.workspace}/projects/${project.id}/photos`}
          label="Photos"
          currentPath={`/w/${params.workspace}/projects/${project.id}`}
          badge={totalPhotos > 0 ? String(totalPhotos) : undefined}
        />
      </div>

      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap pb-5 md:pb-7 border-b border-line bg-paper p-4 md:p-7 -mx-4 md:-m-7 mb-5 md:mb-7">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-ink-50 mb-1 truncate">
            {project.code ?? 'PROJECT'} · {project.client?.name ?? 'NO CLIENT'}
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">{project.name}</h2>
          {project.description ? (
            <p className="text-[13px] text-ink-70 mt-2 max-w-2xl">{project.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="px-3 py-1 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.12em]">
            {project.status}
          </span>
          {project.contractValue ? (
            <div className="font-black text-xl md:text-2xl">${Number(project.contractValue).toLocaleString()}</div>
          ) : null}
        </div>
      </div>

      {/* 4-cell KPIs (2x2 on mobile, 1x4 on desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-line bg-paper mb-6">
        <div className="p-4 md:p-5 border-r border-b md:border-b-0 border-line">
          <div className="label-mono">Contract</div>
          <div className="font-black text-xl md:text-2xl">${(project.contractValue ? Number(project.contractValue) : 0).toLocaleString()}</div>
        </div>
        <div className="p-4 md:p-5 border-b md:border-b-0 border-line">
          <div className="label-mono">Billed</div>
          <div className="font-black text-xl md:text-2xl">${totalBilled.toLocaleString()}</div>
        </div>
        <div className="p-4 md:p-5 border-r border-line">
          <div className="label-mono">Remaining</div>
          <div className="font-black text-xl md:text-2xl text-orange-d">${remaining.toLocaleString()}</div>
        </div>
        <div className="p-4 md:p-5">
          <div className="label-mono">Pay apps</div>
          <div className="font-black text-xl md:text-2xl">{project.payApps.length}</div>
        </div>
      </div>

      {/* Photos summary — links to photos tab */}
      <Link
        href={`/w/${params.workspace}/projects/${project.id}/photos`}
        className="block bg-paper border-2 border-line hover:border-ink p-4 mb-6 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              {'// Photos'}
            </div>
            <div className="text-[13px] font-extrabold mt-1">
              {totalPhotos} photo{totalPhotos === 1 ? '' : 's'} on file
              {totalPhotos > 0 ? (
                <span className="text-ink-50 font-normal ml-2">
                  ({photoCounts.ROUGH_IN} rough-in · {photoCounts.FINAL} final)
                </span>
              ) : null}
            </div>
          </div>
          {totalPhotos > 0 ? (
            <div className="flex gap-1">
              {photoCounts.ROUGH_IN > 0 ? (
                <span className="px-2 py-1 bg-warning text-ink text-[9px] font-extrabold uppercase tracking-[0.1em]">
                  {photoCounts.ROUGH_IN} R
                </span>
              ) : null}
              {photoCounts.FINAL > 0 ? (
                <span className="px-2 py-1 bg-success text-paper text-[9px] font-extrabold uppercase tracking-[0.1em]">
                  {photoCounts.FINAL} F
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d">
              + Add photos →
            </span>
          )}
        </div>
      </Link>

      {/* SOV Section */}
      <div className="bg-paper border-2 border-line mb-6">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="label-eyebrow">{'// Schedule of values'}</div>
            <div className="text-[11px] text-ink-50 mt-0.5">
              ${totalBudget.toLocaleString()} across {project.divisions.length} division{project.divisions.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        {project.divisions.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-50">
            No divisions yet. Add your first line item below.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  {['Code', 'Trade', 'Subcontractor', 'Budget', 'Billed', 'Remaining'].map((h) => (
                    <th key={h} className="text-left px-3 md:px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.divisions.map((d) => {
                  const billed = project.payApps
                    .flatMap((p) => p.divisions)
                    .filter((line) => line.projectDivisionId === d.id)
                    .reduce((acc, l) => acc + Number(l.thisDrawAmount), 0);
                  const rem = Number(d.budget) - billed;
                  // Find an assigned sub from the subLinks (preferred), else fall back to free-text
                  const linkedSub = d.subLinks?.[0]?.assignment?.subcontractor;
                  return (
                    <tr key={d.id} className="hover:bg-cream-2">
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-mono text-[12px]">{d.code}</td>
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-extrabold text-[13px]">{d.trade}</td>
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft text-[12px]">
                        {linkedSub ? (
                          <Link href={`/w/${params.workspace}/subcontractors/${linkedSub.id}`} className="text-orange-d font-extrabold hover:underline">
                            {linkedSub.name}
                          </Link>
                        ) : d.subcontractorName ? (
                          <span className="text-ink-70">{d.subcontractorName}</span>
                        ) : (
                          <span className="text-ink-30">—</span>
                        )}
                      </td>
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-black">${Number(d.budget).toLocaleString()}</td>
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-black text-success">${billed.toLocaleString()}</td>
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-black text-orange-d">${rem.toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr className="bg-ink text-cream">
                  <td colSpan={3} className="px-3 md:px-5 py-3 font-extrabold uppercase text-[11px] tracking-[0.12em]">Totals</td>
                  <td className="px-3 md:px-5 py-3 font-black text-lg">${totalBudget.toLocaleString()}</td>
                  <td className="px-3 md:px-5 py-3 font-black text-lg">${totalBilled.toLocaleString()}</td>
                  <td className="px-3 md:px-5 py-3 font-black text-lg">${(totalBudget - totalBilled).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 md:p-6 border-t border-line">
          <NewDivisionForm workspaceSlug={params.workspace} projectId={project.id} />
        </div>
      </div>

      {/* Schedule (Gantt) */}
      <div className="mb-6">
        <GanttChart
          workspaceSlug={params.workspace}
          projectName={project.name}
          projectStart={project.startDate}
          projectEnd={project.endDate}
          tasks={project.tasks.map<GanttTask>((t) => ({
            id: t.id,
            title: t.title,
            status: t.status as GanttTask['status'],
            priority: t.priority as GanttTask['priority'],
            startDate: t.startDate,
            endDate: t.endDate,
            dueDate: t.dueDate,
          }))}
        />
      </div>

      {/* Subcontractors Section */}
      <div className="bg-paper border-2 border-line mb-6">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="label-eyebrow">{'// Subcontractors'}</div>
            <div className="text-[11px] text-ink-50 mt-0.5">
              {project.subAssignments.length} assignment{project.subAssignments.length === 1 ? '' : 's'}
              {project.subAssignments.length > 0 ? (
                <> · <b className="text-ink">
                  ${project.subAssignments.reduce((acc, a) => acc + Number(a.contractAmount), 0).toLocaleString()}
                </b> contracted</>
              ) : null}
            </div>
          </div>
        </div>

        {project.subAssignments.length === 0 ? (
          <div className="px-6 py-6">
            <AssignSubForm
              workspaceSlug={params.workspace}
              projectId={project.id}
              subs={subs}
              divisions={project.divisions.map((d) => ({
                id: d.id,
                code: d.code,
                trade: d.trade,
                budget: Number(d.budget),
              }))}
            />
          </div>
        ) : (
          <>
            <div className="divide-y divide-line-soft">
              {project.subAssignments.map((a) => (
                <div key={a.id} className="px-6 py-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/w/${params.workspace}/subcontractors/${a.subcontractor.id}`}
                        className="font-extrabold text-[14px] hover:text-orange-d"
                      >
                        {a.subcontractor.name}
                      </Link>
                      <span className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] ${SUB_STATUS_COLOR[a.status] ?? 'bg-line text-ink'}`}>
                        {SUB_STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      {a.subcontractor.primaryTrade ? (
                        <span className="text-[10px] font-mono text-ink-50">primary: {a.subcontractor.primaryTrade}</span>
                      ) : null}
                    </div>
                    {a.divisionLinks.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.divisionLinks.map((dl) => (
                          <span
                            key={dl.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-cream-2 border border-line-soft text-[11px]"
                          >
                            <span className="font-mono text-orange-d font-extrabold">{dl.division.code}</span>
                            <span>{dl.division.trade}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {a.notes ? <p className="text-[11px] text-ink-50 mt-1.5">{a.notes}</p> : null}
                  </div>
                  <div className="text-right">
                    <div className="font-black text-[15px]">${Number(a.contractAmount).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-line">
              <AssignSubForm
                workspaceSlug={params.workspace}
                projectId={project.id}
                subs={subs}
                divisions={project.divisions.map((d) => ({
                  id: d.id,
                  code: d.code,
                  trade: d.trade,
                  budget: Number(d.budget),
                }))}
              />
            </div>
          </>
        )}
      </div>

      {/* Pay Apps Section */}
      <div className="bg-paper border-2 border-line">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-cream-2">
          <div>
            <div className="label-eyebrow">{'// Pay applications'}</div>
            <div className="text-[11px] text-ink-50 mt-0.5">
              {project.payApps.length} draw{project.payApps.length === 1 ? '' : 's'} issued
              {project.payApps.length > 0 ? (
                <> · latest <b className="text-ink">${Number(project.payApps[0].totalThisDraw).toLocaleString()}</b></>
              ) : null}
            </div>
          </div>
          <GeneratePayAppButton
            workspaceSlug={params.workspace}
            projectId={project.id}
            hasDivisions={project.divisions.length > 0}
          />
        </div>
        {project.payApps.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-50">
            <p className="mb-4">No pay apps yet. Generate the first draw once you have at least one division.</p>
            {project.divisions.length > 0 ? (
              <Link
                href={`/w/${params.workspace}/projects/${project.id}/pay-apps/new`}
                className="inline-block px-5 py-3 bg-orange text-paper border-2 border-orange font-extrabold uppercase tracking-[0.12em] text-xs"
              >
                + Generate the first pay app
              </Link>
            ) : null}
          </div>
        ) : (
          <div>
            {project.payApps.map((p) => (
              <Link
                key={p.id}
                href={`/w/${params.workspace}/projects/${project.id}/pay-apps/${p.id}`}
                className="grid grid-cols-[80px_1fr_140px_140px_140px_140px_40px] gap-3 px-5 py-3.5 border-b border-line-soft last:border-0 items-center hover:bg-cream-2"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-50">#{p.drawNumber}</div>
                <div>
                  <div className="font-extrabold text-[13px]">
                    {p.periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {p.periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em]">
                    {p.status} {p.viewCount > 0 ? `· ${p.viewCount} view${p.viewCount === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">CONTRACT</div>
                  <div className="font-extrabold text-[13px]">${Number(p.totalContract).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">PREVIOUS</div>
                  <div className="font-extrabold text-[13px]">${Number(p.totalPrevious).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">THIS DRAW</div>
                  <div className="font-black text-[15px] text-orange-d">${Number(p.totalThisDraw).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">BALANCE</div>
                  <div className="font-extrabold text-[13px]">${Number(p.totalBalance).toLocaleString()}</div>
                </div>
                <div className="text-right text-ink-50">→</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Team discussion */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessageThread
          workspaceSlug={params.workspace}
          entityType="PROJECT"
          entityId={project.id}
          initialMessages={messages}
          currentUserId={userId ?? ''}
          isAdmin={isAdmin}
          heading="Team discussion"
        />

        {/* Activity history */}
        <div className="bg-paper border-2 border-line p-5">
          <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em] mb-3">History</h2>
          <ActivityFeed entries={activity} emptyMessage="No activity yet." />
        </div>
      </div>
    </div>
  );
}

function ProjectTab({
  href,
  label,
  currentPath,
  badge,
}: {
  href: string;
  label: string;
  currentPath: string;
  badge?: string;
}) {
  // Active if href === currentPath (Overview) or currentPath ends with /photos
  const isActive = href === currentPath;
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] border-b-[3px] -mb-[2px] flex items-center gap-1.5 ${
        isActive
          ? 'border-orange text-ink'
          : 'border-transparent text-ink-50 hover:text-ink'
      }`}
    >
      {label}
      {badge ? (
        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-orange text-paper">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
