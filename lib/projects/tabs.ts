/**
 * Shared project-tab configuration.
 *
 * Every page that surfaces the project nav (the main overview,
 * /photos, /pay-apps, the individual pay-app detail, the new
 * pay-app form) should call `getProjectTabs(workspaceId, projectId)`
 * and pass the result to <ProjectTabs>. Keeping the tab list
 * and badge data in one place means:
 *
 *   1. Dedicated routes (photos, pay-apps) show the SAME tabs
 *      as the main project page — including AI board, Takeoff,
 *      Inventory, Map. Before this helper, those routes silently
 *      dropped four tabs, breaking navigation consistency.
 *
 *   2. Adding a tab is a one-file change. Add it to the
 *      TAB_KEYS order array, add the corresponding badge
 *      computation below, and the new tab appears everywhere.
 *
 *   3. The badge counts (rough-in + final photos, tasks, team
 *      size, overdue inspections, pay apps, subs, BIM models,
 *      GPS-tagged photos, AI insights at warning/danger level)
 *      are all computed in parallel and cached by Prisma's
 *      connection pool. Dedicated routes that didn't have this
 *      data before (pay-app detail, pay-app new) now get it for
 *      free without a second round trip.
 */
import { prisma } from '@/lib/db/client';
import { listProjectPermits, summarizePermits } from '@/lib/permits/queries';
import { countProjectPhotosByPhase } from '@/lib/photos/queries';
import type { ProjectTab } from '@/app/(app)/w/[workspace]/projects/[id]/ProjectTabs';

export interface ProjectTabsContext {
  workspaceSlug: string;
  projectId: string;
  taskCount: number;
  payAppCount: number;
  subAssignmentCount: number;
  teamMemberCount: number;
  bimModelCount?: number;
  gpsPhotoCount?: number;
  /** AI insight count at warning/danger level — used for the AI board badge. */
  aiAlertCount?: number;
  /** Open (currently on-site) check-in count — used for the Check-in tab badge. */
  openCheckInCount?: number;
}

/**
 * Build the full tab list for a project.
 *
 * Pass counts you've already fetched (e.g. from a parent page
 * that already loaded the full project); for the dedicated
 * routes that don't have those counts, the helper re-fetches
 * only what's missing so the tab bar still renders the same.
 */
export async function getProjectTabs(ctx: ProjectTabsContext): Promise<ProjectTab[]> {
  const { workspaceSlug, projectId } = ctx;
  const base = `/w/${workspaceSlug}/projects/${projectId}`;

  // Pull everything we need to compute badges in parallel. We
  // count over a small handful of rows each so even a project
  // with thousands of records returns in a few ms.
  const [photoCounts, permits] = await Promise.all([
    countProjectPhotosByPhase(projectId),
    listProjectPermits(projectId),
  ]);

  const permitSummary = summarizePermits(permits);
  const permitsBadge = permitSummary.overdueInspections > 0
    ? permitSummary.overdueInspections
    : permits.length > 0
      ? permits.length
      : undefined;

  const totalPhotos = photoCounts.ROUGH_IN + photoCounts.FINAL;

  return [
    { key: 'overview', label: 'Overview', href: base },
    {
      key: 'ai',
      label: 'AI board',
      href: `${base}?tab=ai`,
      badge: ctx.aiAlertCount && ctx.aiAlertCount > 0 ? ctx.aiAlertCount : undefined,
    },
    {
      key: 'photos',
      label: 'Photos',
      href: `${base}/photos`,
      badge: totalPhotos > 0 ? totalPhotos : undefined,
    },
    {
      key: 'tasks',
      label: 'Tasks',
      href: `${base}?tab=tasks`,
      badge: ctx.taskCount > 0 ? ctx.taskCount : undefined,
    },
    {
      key: 'team',
      label: 'Team',
      href: `${base}?tab=team`,
      badge: ctx.teamMemberCount > 0 ? ctx.teamMemberCount : undefined,
    },
    { key: 'schedule', label: 'Schedule', href: `${base}?tab=schedule` },
    {
      key: 'permits',
      label: 'Permits',
      href: `${base}?tab=permits`,
      badge: permitsBadge,
    },
    {
      key: 'takeoff',
      label: 'Takeoff',
      href: `${base}?tab=takeoff`,
      badge: ctx.bimModelCount && ctx.bimModelCount > 0 ? ctx.bimModelCount : undefined,
    },
    { key: 'inventory', label: 'Inventory', href: `${base}?tab=inventory` },
    {
      key: 'checkins',
      label: 'Check-in',
      href: `${base}/checkins`,
      badge: ctx.openCheckInCount && ctx.openCheckInCount > 0 ? ctx.openCheckInCount : undefined,
    },
    {
      key: 'map',
      label: 'Map',
      href: `${base}?tab=map`,
      badge: ctx.gpsPhotoCount && ctx.gpsPhotoCount > 0 ? ctx.gpsPhotoCount : undefined,
    },
    {
      key: 'pay-apps',
      label: 'Pay apps',
      href: `${base}/pay-apps`,
      badge: ctx.payAppCount > 0 ? ctx.payAppCount : undefined,
    },
    {
      key: 'subs',
      label: 'Subs',
      href: `${base}?tab=subs`,
      badge: ctx.subAssignmentCount > 0 ? ctx.subAssignmentCount : undefined,
    },
    {
      // The dedicated financial guide page (a deep-dive
      // walkthrough of pay apps, billables, margin, AR
      // aging — see /financials/page.tsx). The at-a-glance
      // summary also shows on the Overview tab.
      key: 'financials',
      label: 'Financials',
      href: `${base}/financials`,
    },
  ];
}

/**
 * Helper for callers that don't have any counts handy yet (e.g.
 * the photos and pay-apps dedicated routes). Re-fetches the
 * minimum needed so the tab bar matches the main page.
 *
 *   getProjectTabsFor('udgok', 'p_abc')
 *     → fetches counts, returns 12 tabs
 */
export async function getProjectTabsFor(
  workspaceSlug: string,
  projectId: string,
): Promise<ProjectTab[]> {
  const [taskCount, payAppCount, subAssignmentCount, teamMemberCount, bimModelCount, gpsPhotoCount, openCheckInCount] =
    await Promise.all([
      prisma.task.count({ where: { projectId } }),
      prisma.payApp.count({ where: { projectId } }),
      prisma.projectSubcontractorAssignment.count({ where: { projectId } }),
      prisma.projectMember.count({ where: { projectId } }),
      prisma.bimModel.count({ where: { projectId } }).catch(() => 0),
      prisma.projectPhoto.count({ where: { projectId, latitude: { not: null } } }),
      prisma.checkInEvent.count({ where: { projectId, checkedOutAt: null } }),
    ]);

  return getProjectTabs({
    workspaceSlug,
    projectId,
    taskCount,
    payAppCount,
    subAssignmentCount,
    teamMemberCount,
    bimModelCount,
    gpsPhotoCount,
    openCheckInCount,
  });
}

// Re-export so the page-side component can import both the
// tabs config and the data types from one place if it wants.
export type { ProjectTab };
