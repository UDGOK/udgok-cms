/**
 * Global project health aggregator — pulls every active project across
 * every workspace and runs the completion + rule-based insights on each.
 * The output powers the /admin/ai dashboard.
 */

import { prisma } from '@/lib/db/client';
import { computeProjectCompletion, generateProjectInsights } from '@/lib/projects/insights';
import { isDeepSeekConfigured } from './deepseek';
import { analyzeProjectDeep } from './project-analyzer';

export interface ProjectHealthRow {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  status: string;
  clientName: string | null;
  contractValue: number;
  totalBilled: number;
  completion: number;
  financial: number;
  tasks: number;
  schedule: number;
  subs: number;
  onTrack: boolean | null;
  daysRemaining: number | null;
  riskCount: number;
  warningCount: number;
  /** Top insight (highest severity) for the dashboard row. */
  topInsight: { level: string; title: string; body: string } | null;
  /** True if a DeepSeek analysis was run. */
  hasDeepAnalysis: boolean;
  /** If DeepSeek was run, the health score and summary. */
  deepHealthScore: number | null;
  deepSummary: string | null;
}

export interface GlobalHealth {
  total: number;
  byStatus: Record<string, number>;
  avgCompletion: number;
  avgFinancial: number;
  avgTasks: number;
  atRiskCount: number;
  onTrackCount: number;
  deepseekEnabled: boolean;
  rows: ProjectHealthRow[];
}

export async function getGlobalProjectHealth(): Promise<GlobalHealth> {
  // Pull every project with everything we need for the rule engine.
  // DeepSeek analysis is run separately and in parallel for active projects
  // (up to a small cap so we don't burn the API on massive databases).
  const projects = await prisma.project.findMany({
    where: { status: { in: ['ACTIVE', 'ON_HOLD'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
      client: { select: { name: true } },
      divisions: { select: { id: true, budget: true, payAppLines: { select: { thisDrawAmount: true } } } },
      payApps: {
        select: { id: true, status: true, totalThisDraw: true, totalContract: true, totalPrevious: true, periodStart: true, periodEnd: true, createdAt: true, divisions: { select: { projectDivisionId: true, thisDrawAmount: true } } },
      },
      tasks: {
        select: { id: true, status: true, priority: true, dueDate: true, startDate: true, endDate: true, title: true, assignee: { select: { name: true } } },
      },
      subAssignments: { select: { status: true } },
    },
  });

  // Run DeepSeek for the top 8 active projects (in parallel)
  const topForDeepseek = projects.slice(0, 8);
  const deepseekResults = await Promise.all(
    topForDeepseek.map(async (p) => {
      const projectMeta: import("@/lib/projects/insights").ProjectMeta = {
        id: p.id,
        name: p.name,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        contractValue: p.contractValue ? Number(p.contractValue) : null,
        divisions: p.divisions.map((d) => ({
          id: d.id,
          budget: Number(d.budget),
          payAppLines: d.payAppLines.map((l) => ({ thisDrawAmount: Number(l.thisDrawAmount) })),
        })),
        payApps: p.payApps.map((pa) => ({
          id: pa.id,
          status: pa.status,
          totalThisDraw: Number(pa.totalThisDraw),
          totalContract: Number(pa.totalContract),
          totalPrevious: Number(pa.totalPrevious),
          periodStart: pa.periodStart,
          periodEnd: pa.periodEnd,
          createdAt: pa.createdAt,
          divisions: pa.divisions.map((pd) => ({
            projectDivisionId: pd.projectDivisionId,
            thisDrawAmount: Number(pd.thisDrawAmount),
          })),
        })),
        tasks: p.tasks.map((t) => ({
          id: t.id,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          startDate: t.startDate,
          endDate: t.endDate,
          title: t.title,
          assignee: t.assignee,
        })),
        subAssignments: p.subAssignments.map((a) => ({ status: a.status })),
      };
      const analysis = await analyzeProjectDeep(projectMeta, p.workspace.slug, p.id);
      return { id: p.id, analysis };
    }),
  );

  const deepMap = new Map(deepseekResults.map((r) => [r.id, r.analysis]));

  const rows: ProjectHealthRow[] = projects.map((p) => {
    const projectMeta: import("@/lib/projects/insights").ProjectMeta = {
      id: p.id,
      name: p.name,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      contractValue: p.contractValue ? Number(p.contractValue) : null,
      divisions: p.divisions.map((d) => ({
        id: d.id,
        budget: Number(d.budget),
        payAppLines: d.payAppLines.map((l) => ({ thisDrawAmount: Number(l.thisDrawAmount) })),
      })),
      payApps: p.payApps.map((pa) => ({
        id: pa.id,
        status: pa.status,
        totalThisDraw: Number(pa.totalThisDraw),
        totalContract: Number(pa.totalContract),
        totalPrevious: Number(pa.totalPrevious),
        periodStart: pa.periodStart,
        periodEnd: pa.periodEnd,
        createdAt: pa.createdAt,
        divisions: pa.divisions.map((pd) => ({
          projectDivisionId: pd.projectDivisionId,
          thisDrawAmount: Number(pd.thisDrawAmount),
        })),
      })),
      tasks: p.tasks.map((t) => ({
        id: t.id,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        startDate: t.startDate,
        endDate: t.endDate,
        title: t.title,
        assignee: t.assignee,
      })),
      subAssignments: p.subAssignments.map((a) => ({ status: a.status })),
    };
    const completion = computeProjectCompletion(projectMeta);
    const insights = generateProjectInsights(projectMeta, completion);
    const riskCount = insights.filter((i) => i.level === 'danger').length;
    const warningCount = insights.filter((i) => i.level === 'warning').length;
    const topInsight =
      insights.find((i) => i.level === 'danger') ??
      insights.find((i) => i.level === 'warning') ??
      insights[0] ??
      null;

    const deep = deepMap.get(p.id);

    return {
      id: p.id,
      name: p.name,
      workspaceId: p.workspaceId,
      workspaceName: p.workspace.name,
      workspaceSlug: p.workspace.slug,
      status: p.status,
      clientName: p.client?.name ?? null,
      contractValue: p.contractValue ? Number(p.contractValue) : 0,
      totalBilled: completion.totalBilled,
      completion: completion.overall,
      financial: completion.financial,
      tasks: completion.tasks,
      schedule: completion.schedule,
      subs: completion.subs,
      onTrack: completion.onTrack,
      daysRemaining: completion.daysRemaining,
      riskCount,
      warningCount,
      topInsight: topInsight
        ? { level: topInsight.level, title: topInsight.title, body: topInsight.body }
        : null,
      hasDeepAnalysis: !!deep,
      deepHealthScore: deep?.healthScore ?? null,
      deepSummary: deep?.summary ?? null,
    };
  });

  // Aggregate
  const byStatus: Record<string, number> = { ACTIVE: 0, ON_HOLD: 0 };
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const avgCompletion = rows.length === 0 ? 0 : Math.round(rows.reduce((a, r) => a + r.completion, 0) / rows.length);
  const avgFinancial = rows.length === 0 ? 0 : Math.round(rows.reduce((a, r) => a + r.financial, 0) / rows.length);
  const avgTasks = rows.length === 0 ? 0 : Math.round(rows.reduce((a, r) => a + r.tasks, 0) / rows.length);
  const atRiskCount = rows.filter((r) => r.riskCount > 0).length;
  const onTrackCount = rows.filter((r) => r.onTrack === true).length;

  // Sort: at-risk first, then by overall completion descending
  rows.sort((a, b) => {
    if (a.riskCount !== b.riskCount) return b.riskCount - a.riskCount;
    if (a.warningCount !== b.warningCount) return b.warningCount - a.warningCount;
    return b.completion - a.completion;
  });

  return {
    total: rows.length,
    byStatus,
    avgCompletion,
    avgFinancial,
    avgTasks,
    atRiskCount,
    onTrackCount,
    deepseekEnabled: isDeepSeekConfigured(),
    rows,
  };
}
