import { prisma } from '@/lib/db/client';

interface DivisionRow {
  id: string;
  budget: number;
  payAppLines: { thisDrawAmount: number }[];
}

interface PayAppLite {
  id: string;
  status: string;
  totalThisDraw: number;
  totalContract: number;
  totalPrevious: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  divisions: { projectDivisionId: string; thisDrawAmount: number }[];
}

interface TaskLite {
  id: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  title: string;
  assignee: { name: string | null } | null;
}

export interface ProjectMeta {
  id: string;
  name: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  contractValue: number | null;
  divisions: DivisionRow[];
  payApps: PayAppLite[];
  tasks: TaskLite[];
  subAssignments: { status: string }[];
}

export interface ProjectCompletion {
  /** 0-100, weighted: 50% billed + 50% tasks done. */
  overall: number;
  /** 0-100 — % of contract billed. */
  financial: number;
  /** 0-100 — % of tasks marked DONE. */
  tasks: number;
  /** 0-100 — % of subs that are CONTRACTED or COMPLETED. */
  subs: number;
  /** 0-100 — % of project timeline elapsed (based on start/end). */
  schedule: number;
  totalBilled: number;
  contractValue: number;
  remaining: number;
  tasksTotal: number;
  tasksDone: number;
  subsTotal: number;
  subsActive: number;
  daysElapsed: number | null;
  daysTotal: number | null;
  daysRemaining: number | null;
  onTrack: boolean | null;
}

export function computeProjectCompletion(project: ProjectMeta): ProjectCompletion {
  const contractValue = project.contractValue ?? project.divisions.reduce((acc, d) => acc + d.budget, 0);
  const totalBilled = project.payApps
    .filter((p) => p.status !== 'DRAFT' && p.status !== 'CANCELLED')
    .reduce((acc, p) => acc + p.totalThisDraw, 0);
  const remaining = Math.max(0, contractValue - totalBilled);

  const financial = contractValue > 0 ? Math.min(100, (totalBilled / contractValue) * 100) : 0;

  const tasksTotal = project.tasks.length;
  const tasksDone = project.tasks.filter((t) => t.status === 'DONE' || t.status === 'CANCELLED').length;
  const tasks = tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0;

  const subsTotal = project.subAssignments.length;
  const subsActive = project.subAssignments.filter(
    (s) => s.status === 'CONTRACTED' || s.status === 'ACTIVE' || s.status === 'COMPLETED',
  ).length;
  const subs = subsTotal > 0 ? (subsActive / subsTotal) * 100 : 0;

  let daysElapsed: number | null = null;
  let daysTotal: number | null = null;
  let daysRemaining: number | null = null;
  let schedule = 0;
  if (project.startDate && project.endDate) {
    const now = Date.now();
    const start = project.startDate.getTime();
    const end = project.endDate.getTime();
    if (end > start) {
      daysTotal = Math.ceil((end - start) / 86400000);
      daysElapsed = Math.max(0, Math.ceil((now - start) / 86400000));
      daysRemaining = Math.max(0, Math.ceil((end - now) / 86400000));
      schedule = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    }
  }

  // 50% financial + 30% tasks + 20% subs
  const overall = Math.round(financial * 0.5 + tasks * 0.3 + subs * 0.2);

  // On-track: financial completion roughly matches schedule position (within 20% margin)
  const onTrack = project.startDate && project.endDate && tasksTotal > 0
    ? Math.abs(financial - schedule) < 20
    : null;

  return {
    overall: Math.round(overall),
    financial: Math.round(financial),
    tasks: Math.round(tasks),
    subs: Math.round(subs),
    schedule: Math.round(schedule),
    totalBilled,
    contractValue,
    remaining,
    tasksTotal,
    tasksDone,
    subsTotal,
    subsActive,
    daysElapsed,
    daysTotal,
    daysRemaining,
    onTrack,
  };
}

// =========================================
// SMART INSIGHTS — rule-based AI board
// =========================================

export interface ProjectInsight {
  id: string;
  level: 'success' | 'warning' | 'danger' | 'info';
  category: 'financial' | 'schedule' | 'team' | 'risk' | 'opportunity';
  title: string;
  body: string;
  action?: { label: string; href: string };
}

export function generateProjectInsights(
  project: ProjectMeta,
  completion: ProjectCompletion,
): ProjectInsight[] {
  const insights: ProjectInsight[] = [];
  const contractValue = completion.contractValue;
  const wsBase = `/w/_/projects/${project.id}`;

  // ---- Financial ----
  if (contractValue > 0 && completion.totalBilled === 0 && project.status === 'ACTIVE') {
    insights.push({
      id: 'no-pay-apps',
      level: 'warning',
      category: 'financial',
      title: 'No pay apps yet',
      body: `${project.name} is active but no draws have been issued. Time to bill for the work already done.`,
      action: { label: 'Generate pay app', href: wsBase },
    });
  }

  if (completion.financial > 90 && completion.remaining < contractValue * 0.1) {
    insights.push({
      id: 'near-completion',
      level: 'success',
      category: 'opportunity',
      title: 'Retainage window',
      body: `Only ${completion.remaining.toLocaleString()} left to bill. Time to send the final draw and start tracking retainage release.`,
    });
  }

  if (project.payApps.length > 0) {
    const last = project.payApps[0];
    const daysSince = Math.floor((Date.now() - last.createdAt.getTime()) / 86400000);
    if (daysSince > 30 && project.status === 'ACTIVE' && completion.financial < 95) {
      insights.push({
        id: 'stale-pay-app',
        level: 'warning',
        category: 'financial',
        title: 'No draw in 30+ days',
        body: `Last pay app was ${daysSince} days ago. Submit the next draw before the cash crunch hits.`,
        action: { label: 'Generate pay app', href: wsBase },
      });
    }
  }

  // ---- Schedule ----
  if (completion.schedule > 80 && completion.financial < 50) {
    insights.push({
      id: 'behind-schedule',
      level: 'danger',
      category: 'schedule',
      title: 'Behind schedule — financially',
      body: `${completion.schedule}% of timeline elapsed but only ${completion.financial}% billed. Either accelerate work or update the schedule.`,
    });
  }

  if (completion.daysRemaining !== null && completion.daysRemaining <= 14 && completion.daysRemaining >= 0) {
    insights.push({
      id: 'deadline-approaching',
      level: 'warning',
      category: 'schedule',
      title: 'Deadline approaching',
      body: `Only ${completion.daysRemaining} day${completion.daysRemaining === 1 ? '' : 's'} until contract end. Final inspections, punch list, and retainage billing should be scheduled now.`,
    });
  }

  // ---- Tasks ----
  const overdueTasks = project.tasks.filter(
    (t) => t.dueDate && t.dueDate.getTime() < Date.now() && t.status !== 'DONE' && t.status !== 'CANCELLED',
  );
  if (overdueTasks.length > 0) {
    const high = overdueTasks.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT');
    insights.push({
      id: 'overdue-tasks',
      level: high.length > 0 ? 'danger' : 'warning',
      category: 'risk',
      title: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`,
      body: high.length > 0
        ? `${high.length} of those are HIGH or URGENT priority. Re-assign or break them down — long overdue tasks cost 3x as much.`
        : `Open the Tasks tab to re-prioritize or extend due dates.`,
      action: { label: 'Open tasks', href: wsBase },
    });
  }

  const unassignedOpen = project.tasks.filter(
    (t) => !t.assignee && t.status !== 'DONE' && t.status !== 'CANCELLED',
  );
  if (unassignedOpen.length > 0) {
    insights.push({
      id: 'unassigned-tasks',
      level: 'info',
      category: 'team',
      title: `${unassignedOpen.length} unassigned task${unassignedOpen.length === 1 ? '' : 's'}`,
      body: `Unassigned tasks rarely get done. Pick owners from the Team tab.`,
    });
  }

  // ---- Team ----
  if (project.tasks.length > 0) {
    const taskCounts = new Map<string, number>();
    for (const t of project.tasks) {
      if (t.assignee?.name) {
        taskCounts.set(t.assignee.name, (taskCounts.get(t.assignee.name) ?? 0) + 1);
      }
    }
    if (taskCounts.size === 1 && project.tasks.length >= 3) {
      insights.push({
        id: 'single-owner',
        level: 'warning',
        category: 'risk',
        title: 'Single point of failure',
        body: `One person owns every task on this project. If they get sick or reassigned, nothing moves. Spread the load.`,
      });
    }
  }

  // ---- Subs ----
  const proposedSubs = project.subAssignments.filter((s) => s.status === 'PROPOSED').length;
  if (proposedSubs > 0) {
    insights.push({
      id: 'proposed-subs',
      level: 'info',
      category: 'team',
      title: `${proposedSubs} sub proposal${proposedSubs === 1 ? '' : 's'} pending`,
      body: `Convert them to CONTRACTED once contracts are signed so the schedule reflects reality.`,
    });
  }

  // ---- Positive signals ----
  if (completion.overall > 80) {
    insights.push({
      id: 'strong-progress',
      level: 'success',
      category: 'opportunity',
      title: 'Strong progress',
      body: `${completion.overall}% complete — you're in the home stretch. Final QA, punch list, and closeout should be the only thing left.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'all-good',
      level: 'success',
      category: 'opportunity',
      title: 'No red flags',
      body: 'Everything is on track. Keep shipping draws and updating tasks as work completes.',
    });
  }

  return insights;
}

// =========================================
// DATA FETCHER — single round trip for the
// project detail page (cached per-request)
// =========================================

export async function getProjectWithRelations(workspaceId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, workspaceId },
    include: {
      client: true,
      // The deal this project was converted from (if any).
      // Used to show a "Converted from deal" badge in the
      // project header with a link back to the deal.
      deal: { select: { id: true, title: true, stage: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      divisions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          subLinks: {
            include: { assignment: { include: { subcontractor: true } } },
          },
          payAppLines: true,
        },
      },
      payApps: {
        orderBy: { drawNumber: 'desc' },
        include: { divisions: true },
      },
      subAssignments: {
        orderBy: { createdAt: 'desc' },
        include: {
          subcontractor: true,
          divisionLinks: {
            include: { division: { select: { id: true, code: true, trade: true } } },
          },
        },
      },
      tasks: {
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      files: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      bimModels: {
        orderBy: { createdAt: 'desc' },
        include: {
          takeoffs: { orderBy: { createdAt: 'desc' } },
        },
      },
      bimTakeoffs: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  return project;
}
