/**
 * Sidebar status badges — one batched query that powers
 * the project sidebar. Computes every status indicator
 * the sidebar shows (counts, dollars, warning dots) in a
 * single round-trip so the sidebar renders without
 * waterfalling N queries.
 *
 * Each badge has:
 *   - kind: 'count' | 'money' | 'hot' | 'warn' | 'danger' | 'dot'
 *   - value: number (or string for money, or boolean for dots)
 *   - tone: 'default' | 'warn' | 'danger' | 'hot'
 *   - tooltip: optional explanation string (shown on hover)
 *
 * The sidebar component decides how to render each kind.
 */

import { prisma } from '@/lib/db/client';
import { getProjectFinancialSummary } from './financial-summary';

export type BadgeKind = 'count' | 'money' | 'hot' | 'warn' | 'danger' | 'dot';
export type BadgeTone = 'default' | 'warn' | 'danger' | 'hot';

export interface SidebarBadge {
  kind: BadgeKind;
  value?: number;
  tone: BadgeTone;
  label?: string; // override text (otherwise we render value)
  tooltip?: string;
}

export interface ProjectSidebarStatus {
  projectId: string;
  // Counts (raw)
  photoCount: number;
  photoCountRecent: number;
  taskOpen: number;
  taskOverdue: number;
  teamCount: number;
  bimModelCount: number;
  gpsPhotoCount: number;
  aiAlertCount: number;
  // Schedule
  daysRemaining: number | null;
  daysTotal: number | null;
  onTrack: boolean | null;
  // Money (from financial summary)
  contractValue: number;
  totalBilled: number;
  outstandingAr: number;
  estimatedMarginPct: number;
  poOpenTotal: number;
  invoicePendingApproval: number;
  invoiceApprovedUnpaid: number;
  payAppOpenCount: number;
  payAppOverdueCount: number;
  // Subs
  subActiveCount: number;
  subTotalCount: number;
  // Site
  openCheckInCount: number;
  permitCount: number;
  permitOverdueInspections: number;
  // Computed badges (per sidebar item key)
  badges: Record<string, SidebarBadge | undefined>;
}

export async function getProjectSidebarStatus(
  workspaceId: string,
  projectId: string,
): Promise<ProjectSidebarStatus> {
  const [
    project,
    photoCount,
    taskCounts,
    teamCount,
    bimModelCount,
    gpsPhotoCount,
    subActiveCount,
    subTotalCount,
    openCheckInCount,
    permitSummary,
    payApps,
    financials,
    disputedInvoices,
  ] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { id: projectId, workspaceId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.projectPhoto.count({ where: { projectId } }),
    prisma.task.groupBy({
      by: ['status'],
      where: { projectId, status: { not: 'DONE' } },
      _count: true,
    }),
    prisma.projectMember.count({ where: { projectId } }),
    prisma.bimModel.count({ where: { projectId } }),
    prisma.projectPhoto.count({
      where: { projectId, latitude: { not: null }, longitude: { not: null } },
    }),
    prisma.projectSubcontractorAssignment.count({
      where: { projectId, status: 'ACTIVE' },
    }),
    prisma.projectSubcontractorAssignment.count({ where: { projectId } }),
    prisma.checkInEvent.count({
      where: { projectId, checkedOutAt: null },
    }),
    prisma.permit.findMany({
      where: { projectId },
      include: { inspections: { select: { id: true, result: true, scheduledDate: true } } },
    }),
    prisma.payApp.findMany({
      where: { projectId },
      select: { status: true, sentAt: true },
    }),
    getProjectFinancialSummary(projectId),
    // AI alert approximation: project-scoped conditions that
    // would trigger a warning/danger rule. Cheap, no AI call.
    prisma.poInvoice.count({
      where: { po: { projectId }, status: 'DISPUTED' },
    }),
  ]);

  const taskOpen = taskCounts.reduce((acc, t) => acc + t._count, 0);
  const taskOverdue = await prisma.task.count({
    where: {
      projectId,
      status: { not: 'DONE' },
      dueDate: { lt: new Date() },
    },
  });

  // AI alert = a number of project-level warnings the AI board
  // surfaces (overdue tasks, disputed invoices, etc.).
  const aiAlertCount = taskOverdue + disputedInvoices;

  // Permits: count + overdue inspection count
  const permitCount = permitSummary.length;
  const permitOverdueInspections = permitSummary.reduce(
    (acc, p) => acc + p.inspections.filter((i) => {
      if (i.result === 'FAILED') return true;
      if (i.scheduledDate && new Date(i.scheduledDate) < new Date() && i.result === 'PENDING') return true;
      return false;
    }).length,
    0,
  );

  // Pay apps in flight (SENT/VIEWED/ACKNOWLEDGED, not PAID)
  const payAppOpenCount = payApps.filter(
    (p) => p.status === 'SENT' || p.status === 'VIEWED' || p.status === 'ACKNOWLEDGED',
  ).length;
  // Overdue pay apps (>30 days since sent)
  const now = Date.now();
  const payAppOverdueCount = payApps.filter((p) => {
    if (p.status !== 'SENT' && p.status !== 'VIEWED' && p.status !== 'ACKNOWLEDGED') return false;
    if (!p.sentAt) return false;
    const days = (now - new Date(p.sentAt).getTime()) / 86400000;
    return days > 30;
  }).length;

  // Schedule dates
  const daysRemaining = project.endDate
    ? Math.floor((new Date(project.endDate).getTime() - now) / 86400000)
    : null;
  const daysTotal = project.startDate && project.endDate
    ? Math.floor((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / 86400000)
    : null;
  const daysElapsed = project.startDate
    ? Math.floor((now - new Date(project.startDate).getTime()) / 86400000)
    : null;
  const onTrack = daysRemaining != null && daysElapsed != null && daysTotal
    ? daysElapsed <= daysTotal * 0.8 // arbitrary "on track" heuristic
    : null;

  // Build badges
  const badges: Record<string, SidebarBadge | undefined> = {
    'ai': aiAlertCount > 0
      ? { kind: 'count', value: aiAlertCount, tone: 'warn', tooltip: 'AI-detected alerts' }
      : undefined,
    'photos': photoCount > 0
      ? { kind: 'count', value: photoCount, tone: 'default' }
      : undefined,
    'tasks': taskOverdue > 0
      ? { kind: 'count', value: taskOpen, tone: 'danger', tooltip: `${taskOverdue} overdue` }
      : taskOpen > 0
      ? { kind: 'count', value: taskOpen, tone: 'warn' }
      : undefined,
    'team': teamCount > 0
      ? { kind: 'count', value: teamCount, tone: 'default' }
      : undefined,
    'takeoff': bimModelCount > 0
      ? { kind: 'count', value: bimModelCount, tone: 'default' }
      : undefined,
    'map': gpsPhotoCount > 0
      ? { kind: 'count', value: gpsPhotoCount, tone: 'default' }
      : undefined,
    'pay-apps': payAppOverdueCount > 0
      ? { kind: 'money', value: financials.outstandingAr, tone: 'danger', tooltip: `${payAppOverdueCount} pay app${payAppOverdueCount === 1 ? '' : 's'} >30d` }
      : financials.outstandingAr > 0
      ? { kind: 'money', value: financials.outstandingAr, tone: 'warn' }
      : payAppOpenCount > 0
      ? { kind: 'count', value: payAppOpenCount, tone: 'default' }
      : undefined,
    'financials': financials.estimatedMarginPct < 15 && financials.contractValue > 0
      ? { kind: 'count', value: financials.estimatedMarginPct, tone: 'danger', label: `${financials.estimatedMarginPct}%`, tooltip: 'Margin below 15%' }
      : undefined,
    'subs': subActiveCount > 0
      ? { kind: 'count', value: subActiveCount, tone: subActiveCount < subTotalCount ? 'warn' : 'default' }
      : undefined,
    'inventory': undefined, // no count surfaced yet
    'checkins': openCheckInCount > 0
      ? { kind: 'hot', value: openCheckInCount, tone: 'hot', tooltip: 'Currently on site' }
      : undefined,
    'permits': permitOverdueInspections > 0
      ? { kind: 'count', value: permitOverdueInspections, tone: 'danger', tooltip: 'Overdue inspections' }
      : permitCount > 0
      ? { kind: 'count', value: permitCount, tone: 'default' }
      : undefined,
  };

  return {
    projectId,
    photoCount,
    photoCountRecent: 0, // not used; left for future
    taskOpen,
    taskOverdue,
    teamCount,
    bimModelCount,
    gpsPhotoCount,
    aiAlertCount,
    daysRemaining,
    daysTotal,
    onTrack,
    contractValue: financials.contractValue,
    totalBilled: financials.totalBilled,
    outstandingAr: financials.outstandingAr,
    estimatedMarginPct: financials.estimatedMarginPct,
    poOpenTotal: financials.poOpenTotal,
    invoicePendingApproval: financials.invoicePendingApproval,
    invoiceApprovedUnpaid: financials.invoiceApprovedUnpaid,
    payAppOpenCount,
    payAppOverdueCount,
    subActiveCount,
    subTotalCount,
    openCheckInCount,
    permitCount,
    permitOverdueInspections,
    badges,
  };
}

/**
 * The sidebar config — defines the order, groups, icons,
 * and routes for every sidebar item. Used by both the
 * desktop sidebar and the mobile drawer so they always
 * stay in sync.
 */
export interface SidebarItemConfig {
  key: string;
  label: string;
  /** When true, the link uses ?tab=KEY on the project page; when false, it's a sub-route */
  useTabParam?: boolean;
  /** Optional sub-route segment (e.g. 'photos' → /projects/[id]/photos) */
  subRoute?: string;
  /** External link (e.g. permit portal) */
  external?: boolean;
  /** Optional external URL — when set, subRoute is ignored */
  hrefOverride?: string;
}

export interface SidebarGroup {
  key: string;
  label: string;
  items: SidebarItemConfig[];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    key: 'working',
    label: 'Working',
    items: [
      { key: 'overview', label: 'Overview' },
      { key: 'ai', label: 'AI board', useTabParam: true },
      { key: 'photos', label: 'Photos', subRoute: 'photos' },
      { key: 'tasks', label: 'Tasks', useTabParam: true },
      { key: 'team', label: 'Team', useTabParam: true },
    ],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    items: [
      { key: 'schedule', label: 'Schedule', useTabParam: true },
      { key: 'takeoff', label: 'Takeoff', useTabParam: true },
      { key: 'map', label: 'Map', useTabParam: true },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    items: [
      { key: 'pay-apps', label: 'Pay apps', subRoute: 'pay-apps' },
      { key: 'financials', label: 'Financials', subRoute: 'financials' },
      { key: 'subs', label: 'Subs', useTabParam: true },
      { key: 'inventory', label: 'Inventory', useTabParam: true },
    ],
  },
  {
    key: 'site',
    label: 'Site',
    items: [
      { key: 'checkins', label: 'Check-in', subRoute: 'checkins' },
      { key: 'permits', label: 'Permits', useTabParam: true },
    ],
  },
];

/** Helper: build the href for a sidebar item. */
export function hrefForItem(
  item: SidebarItemConfig,
  workspaceSlug: string,
  projectId: string,
): string {
  if (item.hrefOverride) return item.hrefOverride;
  const base = `/w/${workspaceSlug}/projects/${projectId}`;
  if (item.subRoute) return `${base}/${item.subRoute}`;
  if (item.useTabParam) return `${base}?tab=${item.key}`;
  return base;
}
