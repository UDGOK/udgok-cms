import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getProjectWithRelations, computeProjectCompletion, generateProjectInsights } from '@/lib/projects/insights';
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
import { ProjectTabs } from './ProjectTabs';
import { CompletionRing } from './CompletionRing';
import { AIBoard } from './AIBoard';
import { AddProjectMemberForm } from './AddProjectMemberForm';
import { AddProjectTaskForm } from './AddProjectTaskForm';
import { ProjectTaskRow } from './ProjectTaskRow';
import { RemoveProjectMemberButton } from './RemoveProjectMemberButton';
import { EditProjectDetailsButton } from './EditProjectDetailsButton';

interface ProjectUser {
  id: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}

interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  assignee: ProjectUser | null;
  createdBy: { id: string; name: string | null } | null;
}

interface ProjectDivision {
  id: string;
  code: string;
  trade: string;
  budget: number | { toString(): string };
  subcontractorName: string | null;
  subLinks: { assignment: { subcontractor: { id: string; name: string } } }[];
  payAppLines: { thisDrawAmount: number | { toString(): string } }[];
}

interface ProjectPayApp {
  id: string;
  drawNumber: number;
  status: string;
  totalContract: number | { toString(): string };
  totalPrevious: number | { toString(): string };
  totalThisDraw: number | { toString(): string };
  totalBalance: number | { toString(): string };
  periodStart: Date;
  periodEnd: Date;
  viewCount: number;
  createdAt: Date;
  divisions: { projectDivisionId: string; thisDrawAmount: number | { toString(): string } }[];
}

interface ProjectSubAssignment {
  id: string;
  status: string;
  contractAmount: number | { toString(): string };
  notes: string | null;
  subcontractor: { id: string; name: string; primaryTrade: string | null };
  divisionLinks: { id: string; division: { id: string; code: string; trade: string } }[];
}

interface ProjectData {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  contractValue: number | { toString(): string } | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  client: { id: string; name: string } | null;
  members: { user: ProjectUser; userId: string; role: string | null }[];
  divisions: ProjectDivision[];
  payApps: ProjectPayApp[];
  subAssignments: ProjectSubAssignment[];
  tasks: ProjectTask[];
  files: { id: string; filename: string; url: string }[];
  notes: { id: string; body: string; createdAt: Date }[];
}

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
  searchParams,
}: {
  params: { workspace: string; id: string };
  searchParams: { tab?: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const { userId } = await auth();
  const tab = searchParams.tab ?? 'overview';

  const [project, subs, messages, activity, photoCounts, workspaceMembers, projectMembers, myRole] = await Promise.all([
    getProjectWithRelations(workspace.id, params.id),
    prisma.subcontractor.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, primaryTrade: true },
    }),
    listMessagesForEntity('PROJECT', params.id, 50),
    listEntityActivity(workspace.id, 'project', params.id, 20),
    countProjectPhotosByPhase(params.id),
    prisma.membership.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.projectMember.findMany({
      where: { projectId: params.id },
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: userId!, workspaceId: workspace.id } },
      select: { role: true },
    }),
  ]);
  if (!project) notFound();
  const projectData = project as unknown as ProjectData;

  const isAdmin = myRole?.role === 'OWNER' || myRole?.role === 'ADMIN';
  const canEdit = ['OWNER', 'ADMIN', 'PM'].includes(myRole?.role ?? '');

  // Compute completion
  const projectForInsights = {
    id: projectData.id,
    name: projectData.name,
    status: projectData.status,
    startDate: projectData.startDate,
    endDate: projectData.endDate,
    contractValue: projectData.contractValue ? Number(projectData.contractValue) : null,
    divisions: projectData.divisions.map((d) => ({
      id: d.id,
      budget: Number(d.budget),
      payAppLines: d.payAppLines.map((l) => ({ thisDrawAmount: Number(l.thisDrawAmount) })),
    })),
    payApps: projectData.payApps.map((p) => ({
      id: p.id,
      status: p.status,
      totalThisDraw: Number(p.totalThisDraw),
      totalContract: Number(p.totalContract),
      totalPrevious: Number(p.totalPrevious),
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      createdAt: p.createdAt,
      divisions: p.divisions.map((pd) => ({
        projectDivisionId: pd.projectDivisionId,
        thisDrawAmount: Number(pd.thisDrawAmount),
      })),
    })),
    tasks: projectData.tasks.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      startDate: t.startDate,
      endDate: t.endDate,
      title: t.title,
      assignee: t.assignee,
    })),
    subAssignments: projectData.subAssignments.map((a) => ({ status: a.status })),
  };
  const completion = computeProjectCompletion(projectForInsights);
  const insights = generateProjectInsights(projectForInsights, completion);

  // Build tabs
  const base = `/w/${params.workspace}/projects/${projectData.id}`;
  const tabs = [
    { key: 'overview', label: 'Overview', href: base },
    {
      key: 'ai',
      label: 'AI board',
      href: `${base}?tab=ai`,
      badge: insights.filter((i) => i.level === 'danger' || i.level === 'warning').length > 0
        ? insights.filter((i) => i.level === 'danger' || i.level === 'warning').length
        : undefined,
    },
    { key: 'photos', label: 'Photos', href: `${base}/photos`, badge: photoCounts.ROUGH_IN + photoCounts.FINAL || undefined },
    { key: 'tasks', label: 'Tasks', href: `${base}?tab=tasks`, badge: projectData.tasks.length || undefined },
    { key: 'team', label: 'Team', href: `${base}?tab=team`, badge: projectMembers.length || undefined },
    { key: 'schedule', label: 'Schedule', href: `${base}?tab=schedule` },
    { key: 'pay-apps', label: 'Pay apps', href: `${base}/pay-apps`, badge: projectData.payApps.length || undefined },
    { key: 'subs', label: 'Subs', href: `${base}?tab=subs`, badge: projectData.subAssignments.length || undefined },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <MobilePageHeader
        title={projectData.name}
        subtitle={`${projectData.code ?? 'PROJECT'} · ${projectData.client?.name ?? 'No client'}`}
        backHref={`/w/${params.workspace}/projects`}
        actionLabel="+ Pay app"
        actionHref={
          projectData.divisions.length > 0
            ? `${base}/pay-apps/new`
            : `${base}?tab=pay-apps`
        }
        actionVariant="copper"
      />

      <ProjectTabs tabs={tabs} />

      {/* Header — project name, status, completion ring */}
      <div className="mt-5 flex justify-between items-start gap-4 flex-wrap pb-5 md:pb-7 border-b border-line bg-paper p-4 md:p-7 -mx-4 md:-m-7 mb-5 md:mb-7">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-ink-50 mb-1 truncate">
            {projectData.code ?? 'PROJECT'} · {projectData.client?.name ?? 'NO CLIENT'}
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">{projectData.name}</h2>
          {projectData.description ? (
            <p className="text-[13px] text-ink-70 mt-2 max-w-2xl">{projectData.description}</p>
          ) : null}
          {projectData.address ? (
            <div className="text-[12px] text-ink-50 mt-2 flex items-center gap-1.5">
              <span aria-hidden>◉</span>
              <span>
                {projectData.address}
                {projectData.city ? `, ${projectData.city}` : ''}
                {projectData.state ? `, ${projectData.state}` : ''}
                {projectData.zip ? ` ${projectData.zip}` : ''}
              </span>
            </div>
          ) : null}
          <div className="mt-2">
            <EditProjectDetailsButton
              workspaceSlug={params.workspace}
              projectId={projectData.id}
              initial={{
                address: projectData.address,
                city: projectData.city,
                state: projectData.state,
                zip: projectData.zip,
                description: projectData.description,
                startDate: projectData.startDate,
                endDate: projectData.endDate,
                contractValue: projectData.contractValue ? Number(projectData.contractValue) : null,
                status: projectData.status,
              }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <span className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
            projectData.status === 'ACTIVE' ? 'bg-success text-paper' :
            projectData.status === 'COMPLETED' ? 'bg-ink text-paper' :
            projectData.status === 'ON_HOLD' ? 'bg-warning text-ink' :
            'bg-line text-ink-50'
          }`}>
            {projectData.status}
          </span>
          <CompletionRing
            value={completion.overall}
            size={88}
            label="complete"
            sublabel={`${completion.tasksDone}/${completion.tasksTotal} tasks done`}
          />
          {projectData.contractValue ? (
            <div className="text-right">
              <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">CONTRACT</div>
              <div className="font-black text-lg">${Number(projectData.contractValue).toLocaleString()}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Render the active tab */}
      {tab === 'overview' ? (
        <OverviewTab
          projectId={projectData.id}
          workspace={params.workspace}
          project={projectData}
          photoCounts={photoCounts}
          completion={completion}
        />
      ) : null}

      {tab === 'ai' ? (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange text-paper flex items-center justify-center font-black text-lg">
              ✦
            </div>
            <div>
              <h2 className="font-black text-xl md:text-2xl tracking-tight">Smart Project AI</h2>
              <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
                Insights generated from your data · refreshed in real time
              </p>
            </div>
          </div>
          <AIBoard insights={insights} />
          <div className="mt-5 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-30 text-center">
            Based on {projectData.tasks.length} task{projectData.tasks.length === 1 ? '' : 's'} ·
            {' '}{projectData.payApps.length} pay app{projectData.payApps.length === 1 ? '' : 's'} ·
            {' '}{projectData.divisions.length} division{projectData.divisions.length === 1 ? '' : 's'} ·
            {' '}{projectData.subAssignments.length} sub assignment{projectData.subAssignments.length === 1 ? '' : 's'}
          </div>
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <TasksTab
          projectId={projectData.id}
          workspace={params.workspace}
          project={projectData}
          workspaceMembers={workspaceMembers.map((m) => m.user as unknown as ProjectUser)}
        />
      ) : null}

      {tab === 'team' ? (
        <TeamTab
          projectId={projectData.id}
          workspace={params.workspace}
          projectMembers={projectMembers.map((p) => p.user as unknown as ProjectUser)}
          projectMemberRoles={projectMembers.map((p) => ({ userId: p.userId, role: p.role }))}
          workspaceMembers={workspaceMembers.map((m) => m.user as unknown as ProjectUser)}
          canEdit={canEdit}
        />
      ) : null}

      {tab === 'schedule' ? (
        <ScheduleTab
          project={projectData}
          workspace={params.workspace}
          completion={completion}
        />
      ) : null}

      {tab === 'subs' ? (
        <SubsTab
          projectId={projectData.id}
          workspace={params.workspace}
          project={projectData}
          subs={subs}
        />
      ) : null}

      {tab === 'pay-apps' ? (
        <PayAppsTab
          projectId={projectData.id}
          workspace={params.workspace}
          project={projectData}
        />
      ) : null}

      {/* Always-on team discussion + activity on overview/ai/team tabs */}
      {(tab === 'overview' || tab === 'ai' || tab === 'team') ? (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MessageThread
            workspaceSlug={params.workspace}
            entityType="PROJECT"
            entityId={projectData.id}
            initialMessages={messages}
            currentUserId={userId ?? ''}
            isAdmin={isAdmin}
            heading="Team discussion"
          />
          <div className="bg-paper border-2 border-line p-5">
            <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em] mb-3">History</h2>
            <ActivityFeed entries={activity} emptyMessage="No activity yet." />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =========================================
// TAB: Overview
// =========================================

function OverviewTab({
  projectId,
  workspace,
  project,
  photoCounts,
  completion,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
  photoCounts: { ROUGH_IN: number; FINAL: number };
  completion: ReturnType<typeof computeProjectCompletion>;
}) {
  const totalBudget = project.divisions.reduce((acc, d) => acc + Number(d.budget), 0);
  const totalBilled = project.payApps
    .filter((p) => p.status === 'PAID' || p.status === 'ACKNOWLEDGED' || p.status === 'VIEWED' || p.status === 'SENT')
    .reduce((acc, p) => acc + Number(p.totalThisDraw), 0);
  const totalPhotos = photoCounts.ROUGH_IN + photoCounts.FINAL;
  const base = `/w/${workspace}/projects/${projectId}`;

  return (
    <div>
      {/* 4-cell KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-line bg-paper mb-6">
        <div className="p-4 md:p-5 border-r border-b md:border-b-0 border-line">
          <div className="label-mono">Contract</div>
          <div className="font-black text-xl md:text-2xl">${completion.contractValue.toLocaleString()}</div>
        </div>
        <div className="p-4 md:p-5 border-b md:border-b-0 border-line">
          <div className="label-mono">Billed</div>
          <div className="font-black text-xl md:text-2xl text-success">${completion.totalBilled.toLocaleString()}</div>
          <div className="text-[10px] font-mono text-ink-50 mt-1">
            {completion.financial}% of contract
          </div>
        </div>
        <div className="p-4 md:p-5 border-r border-line">
          <div className="label-mono">Remaining</div>
          <div className="font-black text-xl md:text-2xl text-orange-d">${completion.remaining.toLocaleString()}</div>
        </div>
        <div className="p-4 md:p-5">
          <div className="label-mono">Days left</div>
          <div className="font-black text-xl md:text-2xl">
            {completion.daysRemaining !== null ? completion.daysRemaining : '—'}
          </div>
          {completion.daysTotal !== null ? (
            <div className="text-[10px] font-mono text-ink-50 mt-1">
              of {completion.daysTotal} day timeline
            </div>
          ) : null}
        </div>
      </div>

      {/* Completion breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <CompletionCell
          label="Financial"
          value={completion.financial}
          sub={`$${completion.totalBilled.toLocaleString()} billed`}
        />
        <CompletionCell
          label="Tasks"
          value={completion.tasks}
          sub={`${completion.tasksDone} of ${completion.tasksTotal} done`}
        />
        <CompletionCell
          label="Schedule"
          value={completion.schedule}
          sub={
            completion.daysElapsed !== null
              ? `Day ${completion.daysElapsed} of ${completion.daysTotal ?? '?'}`
              : 'no dates set'
          }
          warn={completion.onTrack === false}
        />
        <CompletionCell
          label="Subs"
          value={completion.subs}
          sub={`${completion.subsActive} of ${completion.subsTotal} active`}
        />
      </div>

      {/* Quick-action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <Link
          href={`${base}/photos`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Photos'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">
            {totalPhotos} photo{totalPhotos === 1 ? '' : 's'} on file
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            View gallery →
          </div>
        </Link>
        <Link
          href={`${base}?tab=tasks`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Tasks'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">
            {project.tasks.length} task{project.tasks.length === 1 ? '' : 's'}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Manage tasks →
          </div>
        </Link>
        <Link
          href={`${base}?tab=ai`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// AI insights'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">
            Smart analysis
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Open AI board →
          </div>
        </Link>
      </div>

      {/* SOV summary */}
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
                  const linkedSub = d.subLinks?.[0]?.assignment?.subcontractor;
                  return (
                    <tr key={d.id} className="hover:bg-cream-2">
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-mono text-[12px]">{d.code}</td>
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-extrabold text-[13px]">{d.trade}</td>
                      <td className="px-3 md:px-5 py-3 border-b border-line-soft text-[12px]">
                        {linkedSub ? (
                          <Link href={`/w/${workspace}/subcontractors/${linkedSub.id}`} className="text-orange-d font-extrabold hover:underline">
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
          <NewDivisionForm workspaceSlug={workspace} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}

function CompletionCell({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: number;
  sub: string;
  warn?: boolean;
}) {
  const color = value >= 80 ? 'bg-success' : value >= 40 ? 'bg-orange' : 'bg-error';
  return (
    <div className="bg-paper border-2 border-line p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className={`font-black text-2xl ${warn ? 'text-error' : ''}`}>{value}%</div>
        {warn ? (
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-error">off track</span>
        ) : null}
      </div>
      <div className="h-1 bg-cream-2 mt-2 mb-1.5">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
        {sub}
      </div>
    </div>
  );
}

// =========================================
// TAB: Tasks
// =========================================

function TasksTab({
  projectId,
  workspace,
  project,
  workspaceMembers,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
  workspaceMembers: ProjectUser[];
}) {
  const tasks = project.tasks ?? [];
  const grouped = {
    TODO: tasks.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
    BLOCKED: tasks.filter((t) => t.status === 'BLOCKED'),
    DONE: tasks.filter((t) => t.status === 'DONE'),
    CANCELLED: tasks.filter((t) => t.status === 'CANCELLED'),
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Project tasks</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {tasks.length} total · {grouped.DONE.length} done · {grouped.IN_PROGRESS.length} in progress
          </p>
        </div>
        <AddProjectTaskForm
          workspaceSlug={workspace}
          projectId={projectId}
          members={workspaceMembers}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
          No tasks yet. Click &ldquo;+ New task&rdquo; to add the first one.
        </div>
      ) : (
        <div className="space-y-5">
          {(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const).map((status) => {
            const list = grouped[status];
            if (list.length === 0) return null;
            const sectionLabels: Record<typeof status, string> = {
              TODO: 'To Do',
              IN_PROGRESS: 'In Progress',
              BLOCKED: 'Blocked',
              DONE: 'Done',
            };
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                    {sectionLabels[status]}
                  </h3>
                  <span className="text-[10px] font-mono text-ink-30">· {list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((t) => (
                    <ProjectTaskRow
                      key={t.id}
                      workspaceSlug={workspace}
                      projectId={projectId}
                      task={t}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================
// TAB: Team (project members)
// =========================================

function TeamTab({
  projectId,
  workspace,
  projectMembers,
  projectMemberRoles,
  workspaceMembers,
  canEdit,
}: {
  projectId: string;
  workspace: string;
  projectMembers: ProjectUser[];
  projectMemberRoles: { userId: string; role: string | null }[];
  workspaceMembers: ProjectUser[];
  canEdit: boolean;
}) {
  const existingIds = projectMembers.map((u) => u.id);
  const roleMap = new Map(projectMemberRoles.map((r) => [r.userId, r.role]));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Project team</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {projectMembers.length} member{projectMembers.length === 1 ? '' : 's'} on this project
          </p>
        </div>
        {canEdit ? (
          <AddProjectMemberForm
            workspaceSlug={workspace}
            projectId={projectId}
            members={workspaceMembers}
            existingUserIds={existingIds}
          />
        ) : null}
      </div>

      {projectMembers.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
          No teammates added yet. {canEdit ? 'Click "+ Add teammate" to assign someone to this project.' : 'Ask a project manager to add team members.'}
        </div>
      ) : (
        <div className="bg-paper border-2 border-line divide-y divide-line-soft">
          {projectMembers.map((m) => {
            const role = roleMap.get(m.id);
            return (
              <div key={m.id} className="p-4 md:p-5 flex items-center gap-4">
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ink text-cream flex items-center justify-center font-black text-sm flex-shrink-0">
                    {(m.name || m.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[14px] truncate">{m.name || 'Unknown'}</div>
                  <div className="text-[12px] text-ink-50 truncate">{m.email}</div>
                  {role ? (
                    <div className="mt-1">
                      <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] bg-cream-2 border border-line">
                        {role}
                      </span>
                    </div>
                  ) : null}
                </div>
                {canEdit ? (
                  <RemoveProjectMemberButton
                    workspaceSlug={workspace}
                    projectId={projectId}
                    userId={m.id}
                    userName={m.name || m.email || 'Unknown'}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================
// TAB: Schedule (Gantt)
// =========================================

function ScheduleTab({
  project,
  workspace,
  completion,
}: {
  project: ProjectData;
  workspace: string;
  completion: ReturnType<typeof computeProjectCompletion>;
}) {
  // Only show tasks that have any date info on the Gantt
  const ganttTasks = project.tasks
    .filter((t) => t.startDate || t.endDate || t.dueDate)
    .map<GanttTask>((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as GanttTask['status'],
      priority: t.priority as GanttTask['priority'],
      startDate: t.startDate,
      endDate: t.endDate,
      dueDate: t.dueDate,
    }));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Schedule</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {ganttTasks.length} scheduled task{ganttTasks.length === 1 ? '' : 's'}
            {completion.daysTotal ? ` · ${completion.daysElapsed ?? 0} of ${completion.daysTotal} days elapsed` : ''}
          </p>
        </div>
      </div>

      {/* Schedule progress bar */}
      {completion.daysTotal ? (
        <div className="bg-paper border-2 border-line p-5 mb-5">
          <div className="flex items-center justify-between text-[12px] font-extrabold mb-2">
            <span>Schedule progress</span>
            <span>
              Day {completion.daysElapsed} of {completion.daysTotal} ({completion.schedule}%)
            </span>
          </div>
          <div className="h-2 bg-cream-2">
            <div
              className={`h-full ${
                completion.onTrack === false ? 'bg-error' : 'bg-success'
              }`}
              style={{ width: `${Math.min(100, completion.schedule)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-2">
            <span>{project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</span>
            <span>{project.endDate ? new Date(project.endDate).toLocaleDateString() : '—'}</span>
          </div>
        </div>
      ) : (
        <div className="bg-paper border-2 border-line p-5 mb-5 text-[13px] text-ink-50">
          No start/end dates set. Edit project details to add them.
        </div>
      )}

      <GanttChart
        workspaceSlug={workspace}
        projectName={project.name}
        projectStart={project.startDate}
        projectEnd={project.endDate}
        tasks={ganttTasks}
      />
    </div>
  );
}

// =========================================
// TAB: Subs
// =========================================

function SubsTab({
  projectId,
  workspace,
  project,
  subs,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
  subs: { id: string; name: string; primaryTrade: string | null }[];
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-black text-xl md:text-2xl tracking-tight">Subcontractors</h2>
        <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
          {project.subAssignments.length} assignment{project.subAssignments.length === 1 ? '' : 's'}
          {project.subAssignments.length > 0 ? (
            <>
              {' · '}
              <b className="text-ink">
                ${project.subAssignments.reduce((acc, a) => acc + Number(a.contractAmount), 0).toLocaleString()}
              </b>
              {' '}contracted
            </>
          ) : null}
        </p>
      </div>

      {project.subAssignments.length === 0 ? (
        <div className="bg-paper border-2 border-line p-6">
          <AssignSubForm
            workspaceSlug={workspace}
            projectId={projectId}
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
        <div className="bg-paper border-2 border-line">
          <div className="divide-y divide-line-soft">
            {project.subAssignments.map((a) => (
              <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/w/${workspace}/subcontractors/${a.subcontractor.id}`}
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
          <div className="px-5 py-4 border-t border-line">
            <AssignSubForm
              workspaceSlug={workspace}
              projectId={projectId}
              subs={subs}
              divisions={project.divisions.map((d) => ({
                id: d.id,
                code: d.code,
                trade: d.trade,
                budget: Number(d.budget),
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================
// TAB: Pay apps
// =========================================

function PayAppsTab({
  projectId,
  workspace,
  project,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Pay applications</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {project.payApps.length} draw{project.payApps.length === 1 ? '' : 's'} issued
          </p>
        </div>
        <GeneratePayAppButton
          workspaceSlug={workspace}
          projectId={projectId}
          hasDivisions={project.divisions.length > 0}
        />
      </div>
      {project.payApps.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
          <p className="mb-4">No pay apps yet. Generate the first draw once you have at least one division.</p>
          {project.divisions.length > 0 ? (
            <Link
              href={`/w/${workspace}/projects/${projectId}/pay-apps/new`}
              className="inline-block px-5 py-3 bg-orange text-paper border-2 border-orange font-extrabold uppercase tracking-[0.12em] text-xs"
            >
              + Generate the first pay app
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="bg-paper border-2 border-line">
          {project.payApps.map((p) => (
            <Link
              key={p.id}
              href={`/w/${workspace}/projects/${projectId}/pay-apps/${p.id}`}
              className="grid grid-cols-1 sm:grid-cols-[80px_1fr_140px_140px_140px_140px_40px] gap-3 px-5 py-3.5 border-b border-line-soft last:border-0 items-center hover:bg-cream-2"
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
              <div className="text-right text-ink-50 hidden sm:block">→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
