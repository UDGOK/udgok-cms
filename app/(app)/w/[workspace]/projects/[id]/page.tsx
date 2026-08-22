import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

// Server actions in this file (notably runTakeoffAction) can take
// up to 5 minutes to wait for the Python takeoff service. The
// default Next.js route timeout is 10s; Vercel Pro bumps the
// ceiling to 300s. Keep this aligned with the AbortSignal.timeout
// in runTakeoffAction.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

import {
  getProjectWithRelations,
  computeProjectCompletion,
  generateProjectInsights,
} from '@/lib/projects/insights';
import { getProjectFinancialSummary } from '@/lib/projects/financial-summary';
import { FinancialSummary } from './FinancialSummary';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { MessageThread } from '@/components/messages/MessageThread';
import { listMessagesForEntity } from '@/lib/messages/queries';
import { listEntityActivity } from '@/lib/activity/queries';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import {
  countProjectPhotosByPhase,
  listProjectPhotos,
  listProjectGpsPhotos,
} from '@/lib/photos/queries';
import { CompletionRing } from './CompletionRing';
import { AIBoard } from './AIBoard';
import { TakeoffTab } from './TakeoffTab';
import { ProjectMapTab as MapTab } from './MapTab';
import { InventoryTab } from './InventoryTab';
import type { ProjectStatus } from '@prisma/client';
import { hasValidCoords } from '@/lib/map/valid-coords';
import { EditProjectDetailsButton } from './EditProjectDetailsButton';
import { ProjectLocationBadge } from './ProjectLocationBadge';
import { listProjectPermits, summarizePermits } from '@/lib/permits/queries';
import { generateDeepInsights } from '@/lib/ai/project-analyzer';
import { AskAIChat } from './AskAIChat';

import { OverviewTab } from './tabs/OverviewTab';
import { TasksTab } from './tabs/TasksTab';
import { TeamTab } from './tabs/TeamTab';
import { ScheduleTab } from './tabs/ScheduleTab';
import { SubsTab } from './tabs/SubsTab';
import { PayAppsTab } from './tabs/PayAppsTab';
import { PermitsTab } from './tabs/PermitsTab';
import { MapLocationIssue } from './tabs/MapLocationIssue';

import type { ProjectData, ProjectUser, PermitWithInspections } from './page-types';

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { workspace: string; id: string };
  searchParams: { tab?: string; vendor?: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const { userId } = await auth();
  const tab = searchParams.tab ?? 'overview';

  const [
    project,
    subs,
    messages,
    activity,
    photoCounts,
    recentPhotos,
    workspaceMembers,
    projectMembers,
    myRole,
    permits,
    gpsPhotos,
    financialSummary,
  ] = await Promise.all([
    getProjectWithRelations(workspace.id, params.id),
    prisma.subcontractor.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, primaryTrade: true },
    }),
    listMessagesForEntity('PROJECT', params.id, 50),
    listEntityActivity(workspace.id, 'project', params.id, 20),
    countProjectPhotosByPhase(params.id),
    listProjectPhotos(params.id, {}).then((all) => all.slice(0, 6)),
    prisma.membership.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.projectMember.findMany({
      where: { projectId: params.id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: userId!, workspaceId: workspace.id } },
      select: { role: true },
    }),
    listProjectPermits(params.id),
    // GPS photos for the MAP tab. Limit 500 — projects rarely
    // exceed a few hundred, and a hard cap keeps the map payload
    // bounded even on a busy project.
    listProjectGpsPhotos(params.id, 500),
    // Financial rollup for the embedded FinancialSummary
    // card (top of the project page) and the dedicated
    // /financials deep-dive page. One batch, one pass —
    // see lib/projects/financial-summary.ts.
    getProjectFinancialSummary(params.id),
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

  const base = `/w/${params.workspace}/projects/${projectData.id}`;
  const permitSummary = summarizePermits(permits);

  // Deep AI analysis: now loaded CLIENT-SIDE via /api/ai/project-analysis.
  // The page no longer blocks on the NVIDIA call (which can be slow).
  // AIBoard fires the API itself and shows a loading skeleton until it
  // returns. The rule-based insights below are always available
  // instantly and give the page something useful to show.
  const deepAnalysis = null;
  const deepInsights: Awaited<ReturnType<typeof generateDeepInsights>> = [];

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Mobile-only quick action bar — the layout's mobile
          header has the project name + hamburger + back, but
          project-specific actions like "+ Pay app" still need
          to be reachable on mobile. A small sticky bar below
          the layout's header does the job. */}
      <div className="md:hidden sticky top-[7.5rem] z-20 -mx-4 px-4 py-2 bg-paper border-b border-line flex items-center gap-2">
        <a
          href={
            projectData.divisions.length > 0
              ? `${base}/pay-apps/new`
              : `${base}?tab=pay-apps`
          }
          className="flex-1 px-3 py-2 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] text-center"
        >
          + Generate pay app
        </a>
      </div>

      {/* Header — project name, status, completion ring */}
      <div className="mt-5 flex justify-between items-start gap-4 flex-wrap pb-5 md:pb-7 border-b border-line bg-paper p-4 md:p-7 -mx-4 md:-m-7 mb-5 md:mb-7">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-ink-50 mb-1 truncate">
            {projectData.code ?? 'PROJECT'} · {projectData.client?.name ?? 'NO CLIENT'}
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">{projectData.name}</h2>
          {projectData.deal ? (
            <a
              href={`/w/${params.workspace}/deals/${projectData.deal.id}`}
              className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors"
            >
              ✓ Converted from deal · {projectData.deal.title}
            </a>
          ) : null}
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
          {/* Location pin status — shows coords + source. A small block
              so the user knows geocoding worked and where the pin is. */}
          {projectData.latitude != null && projectData.longitude != null ? (
            <ProjectLocationBadge
              workspaceSlug={params.workspace}
              projectId={projectData.id}
              latitude={projectData.latitude}
              longitude={projectData.longitude}
              geocodeSource={projectData.geocodeSource}
              geocodedAt={projectData.geocodedAt}
              geocodedAddress={projectData.geocodedAddress}
            />
          ) : projectData.address ? (
            <div className="text-[11px] text-ink-30 mt-1.5 font-mono italic">
              📍 Not yet geocoded — will run on next save.
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
                latitude: projectData.latitude,
                longitude: projectData.longitude,
                geocodeSource: projectData.geocodeSource,
                permitPortalUrl: projectData.permitPortalUrl,
                permitPortalLabel: projectData.permitPortalLabel,
                permitPortalNotes: projectData.permitPortalNotes,
              }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <a
              href={`/api/projects/${projectData.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper border-2 border-ink text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper transition-colors"
              title="Generate a 12-20 page project book PDF (every section, every photo, every task)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span className="hidden md:inline">Create PDF</span>
              <span className="md:hidden">PDF</span>
            </a>
            <span className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
              projectData.status === 'ACTIVE' ? 'bg-success text-paper' :
              projectData.status === 'COMPLETED' ? 'bg-ink text-paper' :
              projectData.status === 'ON_HOLD' ? 'bg-warning text-ink' :
              'bg-line text-ink-50'
            }`}>
              {projectData.status}
            </span>
          </div>
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

      {/* Render the active tab. Each tab is now a focused
          file in ./tabs/ — see ./tabs/OverviewTab.tsx, etc. */}
      {tab === 'overview' ? (
        <>
          {/* Financial summary card — the "pulse" of money on
              this project. Shows contract, billed, AR, margin,
              plus a quick snapshot of pay apps and billables.
              The full deep-dive is at /financials. */}
          <FinancialSummary
            workspace={params.workspace}
            projectId={projectData.id}
            summary={financialSummary}
          />
          <OverviewTab
            projectId={projectData.id}
            workspace={params.workspace}
            project={projectData}
            photoCounts={photoCounts}
            recentPhotos={recentPhotos}
            totalPhotoCount={photoCounts.ROUGH_IN + photoCounts.FINAL}
            completion={completion}
          />
        </>
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
          <AIBoard
            ruleInsights={insights}
            initialDeepInsights={deepInsights}
            initialDeepAnalysis={deepAnalysis}
            projectId={projectData.id}
          />
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

      {tab === 'permits' ? (
        <PermitsTab
          projectId={projectData.id}
          workspace={params.workspace}
          project={projectData}
          permits={permits as unknown as PermitWithInspections[]}
          summary={permitSummary}
        />
      ) : null}

      {tab === 'takeoff' ? (
        <TakeoffTab
          workspaceSlug={params.workspace}
          projectId={projectData.id}
          bimModels={projectData.bimModels}
          bimTakeoffs={projectData.bimTakeoffs}
        />
      ) : null}

      {tab === 'inventory' ? (
        <InventoryTab
          workspaceSlug={params.workspace}
          projectId={projectData.id}
          searchParams={searchParams}
        />
      ) : null}

      {tab === 'map' && hasValidCoords(projectData.latitude, projectData.longitude) ? (
        <MapTab
          workspaceSlug={params.workspace}
          project={{
            id: projectData.id,
            name: projectData.name,
            code: projectData.code,
            status: projectData.status as ProjectStatus,
            latitude: projectData.latitude as number,
            longitude: projectData.longitude as number,
            city: projectData.city,
            state: projectData.state,
            geocodeSource: projectData.geocodeSource,
            geocodedAddress: projectData.geocodedAddress,
          }}
          gpsPhotos={gpsPhotos
            .filter((p) => hasValidCoords(p.latitude, p.longitude))
            .map((p) => ({
              id: p.id,
              url: p.url,
              filename: p.filename,
              latitude: p.latitude as number,
              longitude: p.longitude as number,
              room: p.room,
              area: p.area,
              takenAt: p.takenAt ? p.takenAt.toISOString() : null,
            }))}
        />
      ) : tab === 'map' ? (
        <MapLocationIssue
          workspaceSlug={params.workspace}
          projectId={projectData.id}
          hasAnyCoords={projectData.latitude != null || projectData.longitude != null}
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

      <AskAIChat projectId={projectData.id} projectName={projectData.name} />
    </div>
  );
}
