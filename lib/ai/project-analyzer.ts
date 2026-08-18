/**
 * Project analyzer — uses DeepSeek to give an in-depth natural-language
 * analysis of a project based on its current state. The result augments
 * the rule-based insights from lib/projects/insights.ts.
 *
 * Two outputs:
 *   1. analyzeProjectDeep() — a long-form "executive summary" string
 *   2. generateDeepInsights() — a list of ProjectInsight items beyond
 *      what the rule-based engine finds (catches things only an LLM would)
 */

import { deepseekJson, isDeepSeekConfigured } from './deepseek';
import { computeProjectCompletion, type ProjectMeta } from '@/lib/projects/insights';

export interface DeepInsight {
  level: 'success' | 'warning' | 'danger' | 'info';
  category: 'financial' | 'schedule' | 'team' | 'risk' | 'opportunity' | 'communication';
  title: string;
  body: string;
  action?: { label: string; href: string };
}

export interface DeepAnalysis {
  summary: string;
  risks: string[];
  opportunities: string[];
  nextActions: { title: string; why: string; href: string }[];
  healthScore: number; // 0-100
  generatedAt: string;
  model: string;
  cached: boolean;
}

/**
 * Build a context-rich prompt that gives DeepSeek all the project data.
 */
function buildProjectContext(project: ProjectMeta, completion: ReturnType<typeof computeProjectCompletion>) {
  return {
    name: project.name,
    status: project.status,
    contractValue: project.contractValue,
    totalBilled: completion.totalBilled,
    remaining: completion.remaining,
    financialPercent: completion.financial,
    startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
    daysElapsed: completion.daysElapsed,
    daysTotal: completion.daysTotal,
    daysRemaining: completion.daysRemaining,
    schedulePercent: completion.schedule,
    onTrack: completion.onTrack,
    overallCompletion: completion.overall,
    tasks: {
      total: completion.tasksTotal,
      done: completion.tasksDone,
      overdue: project.tasks.filter(
        (t) => t.dueDate && t.dueDate.getTime() < Date.now() && t.status !== 'DONE' && t.status !== 'CANCELLED',
      ).length,
      highPriority: project.tasks.filter((t) => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'DONE').length,
      unassigned: project.tasks.filter((t) => !t.assignee && t.status !== 'DONE' && t.status !== 'CANCELLED').length,
    },
    subs: {
      total: completion.subsTotal,
      active: completion.subsActive,
      proposed: project.subAssignments.filter((s) => s.status === 'PROPOSED').length,
    },
    payApps: {
      total: project.payApps.length,
      sent: project.payApps.filter((p) => p.status === 'SENT' || p.status === 'VIEWED').length,
      paid: project.payApps.filter((p) => p.status === 'PAID').length,
      lastDrawDaysAgo: project.payApps[0]
        ? Math.floor((Date.now() - project.payApps[0].createdAt.getTime()) / 86_400_000)
        : null,
    },
    sov: {
      totalBudget: project.divisions.reduce((acc, d) => acc + d.budget, 0),
      divisionCount: project.divisions.length,
    },
  };
}

const SYSTEM_PROMPT = `You are an expert construction project manager AI assistant.
You analyze project data and give concise, actionable insights.

Your tone: direct, specific, uses construction-industry language. No fluff.
You prefer 1-2 short sentences per insight. Always include numbers when relevant.
When a risk or opportunity is mentioned, name the specific dollar amount, day count,
or task that triggers it.

Always return JSON matching the requested schema exactly. No commentary outside JSON.`;

const ANALYSIS_SCHEMA_HINT = `{
  "summary": "<2-3 sentence executive summary of project health>",
  "healthScore": <0-100 integer reflecting overall health>,
  "risks": ["<risk 1>", "<risk 2>"],
  "opportunities": ["<opportunity 1>", "<opportunity 2>"],
  "nextActions": [
    { "title": "<action title>", "why": "<one sentence justification>", "href": "<relative path like /w/_/projects/_/tasks or /pay-apps>" }
  ]
}`;

const INSIGHTS_SCHEMA_HINT = `{
  "insights": [
    {
      "level": "success" | "warning" | "danger" | "info",
      "category": "financial" | "schedule" | "team" | "risk" | "opportunity" | "communication",
      "title": "<short title>",
      "body": "<1-2 sentence explanation with specific numbers>"
    }
  ]
}`;

/**
 * Run a deep analysis pass. Returns null if DeepSeek isn't configured.
 */
export async function analyzeProjectDeep(
  project: ProjectMeta,
  workspaceSlug: string,
  projectId: string,
): Promise<DeepAnalysis | null> {
  if (!isDeepSeekConfigured()) return null;

  const completion = computeProjectCompletion(project);
  const ctx = buildProjectContext(project, completion);

  const userPrompt = `Analyze this construction project. Be specific and concise.

PROJECT DATA:
${JSON.stringify(ctx, null, 2)}

Return JSON with this exact structure:
${ANALYSIS_SCHEMA_HINT}

Base href for any actions: /w/${workspaceSlug}/projects/${projectId}`;

  try {
    const result = await deepseekJson<{
      summary: string;
      healthScore: number;
      risks: string[];
      opportunities: string[];
      nextActions: { title: string; why: string; href: string }[];
    }>(SYSTEM_PROMPT, userPrompt, { temperature: 0.4, maxTokens: 1500 });

    return {
      summary: result.summary,
      healthScore: Math.max(0, Math.min(100, Math.round(result.healthScore))),
      risks: result.risks ?? [],
      opportunities: result.opportunities ?? [],
      nextActions: result.nextActions ?? [],
      generatedAt: new Date().toISOString(),
      model: 'deepseek-chat',
      cached: false,
    };
  } catch (e) {
    console.error('[DeepSeek] analyzeProjectDeep failed:', e);
    return null;
  }
}

/**
 * Generate a list of DeepSeek-only insights that the rule-based engine
 * would miss. Returns empty array on error or missing config.
 */
export async function generateDeepInsights(
  project: ProjectMeta,
  workspaceSlug: string,
  projectId: string,
): Promise<DeepInsight[]> {
  if (!isDeepSeekConfigured()) return [];

  const completion = computeProjectCompletion(project);
  const ctx = buildProjectContext(project, completion);

  const userPrompt = `Given this construction project data, identify 1-4 non-obvious insights
the rule-based system would miss. Look for things like:
- Cash flow issues
- Bottlenecks in the team
- Tasks piling up around certain dates
- Coordination issues between subs and the schedule
- Early warning signs of disputes or delays

PROJECT DATA:
${JSON.stringify(ctx, null, 2)}

Return JSON:
${INSIGHTS_SCHEMA_HINT}

Base href for any action links: /w/${workspaceSlug}/projects/${projectId}`;

  try {
    const result = await deepseekJson<{ insights: DeepInsight[] }>(
      SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.6, maxTokens: 1200 },
    );
    return (result.insights ?? []).map((i) => ({
      ...i,
      action: undefined, // strip the optional action since we don't ask for it
    }));
  } catch (e) {
    console.error('[DeepSeek] generateDeepInsights failed:', e);
    return [];
  }
}
