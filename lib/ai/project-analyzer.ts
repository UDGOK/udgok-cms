/**
 * Project analyzer — uses NVIDIA NIM (Llama 3.3 70B) to give an in-depth
 * natural-language analysis of a project based on its current state. The
 * result augments the rule-based insights from lib/projects/insights.ts.
 *
 * Three outputs:
 *   1. analyzeProjectDeep() — long-form "executive summary" + health score
 *   2. generateDeepInsights() — list of insights the rule engine would miss
 *   3. draftSubMessage() — draft a message to a specific subcontractor
 *
 * The system prompt is tuned for the UDGOK user: small-to-mid construction
 * contractors, US-based, residential + light commercial. We feed the model
 * the actual sub names, division codes, task titles, etc. so the output
 * is specific (not generic).
 */

import { openrouterJson, isOpenRouterConfigured } from './openrouter';
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
}

export interface SubMessageDraft {
  /** Ready-to-send subject line. */
  subject: string;
  /** The body. Plain text, 1-3 short paragraphs, construction-friendly tone. */
  body: string;
  /** Subtle confidence score 0-100. */
  confidence: number;
  /** One-line reasoning for why this message makes sense right now. */
  why: string;
  generatedAt: string;
}

interface SubLite {
  id: string;
  name: string;
  primaryTrade: string | null;
  status: string;
  contractAmount: number | null;
  divisionLabels: string[];
}

interface DivisionLite {
  id: string;
  code: string;
  trade: string;
  budget: number;
  billed: number;
  remaining: number;
  subcontractorName: string | null;
  linkedSub: string | null;
}

interface TaskLiteFull {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: string | null;
}

interface ProjectContextInput {
  id: string;
  name: string;
  status: string;
  code: string | null;
  clientName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  startDate: Date | null;
  endDate: Date | null;
  contractValue: number | null;
  totalBilled: number;
  totalBudget: number;
  daysElapsed: number | null;
  daysTotal: number | null;
  daysRemaining: number | null;
  schedulePercent: number;
  financialPercent: number;
  overallCompletion: number;
  onTrack: boolean | null;
  subs: SubLite[];
  divisions: DivisionLite[];
  tasks: {
    total: number;
    done: number;
    overdue: number;
    highPriority: number;
    unassigned: number;
    recent: TaskLiteFull[];
  };
  payApps: {
    total: number;
    sent: number;
    paid: number;
    lastDrawDaysAgo: number | null;
    lastDrawAmount: number | null;
  };
  /** Anything DeepSeek should mention by name. */
  hasOverduePermits: boolean;
}

function buildProjectContext(
  project: ProjectMeta,
  completion: ReturnType<typeof computeProjectCompletion>,
  extras: {
    subs?: SubLite[];
    divisions?: DivisionLite[];
    tasks?: TaskLiteFull[];
    projectMeta?: { code: string | null; clientName: string | null; address: string | null; city: string | null; state: string | null };
    permits?: { overdueCount: number };
  } = {},
): ProjectContextInput {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    code: extras.projectMeta?.code ?? null,
    clientName: extras.projectMeta?.clientName ?? null,
    address: extras.projectMeta?.address ?? null,
    city: extras.projectMeta?.city ?? null,
    state: extras.projectMeta?.state ?? null,
    startDate: project.startDate,
    endDate: project.endDate,
    contractValue: project.contractValue,
    totalBilled: completion.totalBilled,
    totalBudget: project.divisions.reduce((acc, d) => acc + d.budget, 0),
    daysElapsed: completion.daysElapsed,
    daysTotal: completion.daysTotal,
    daysRemaining: completion.daysRemaining,
    schedulePercent: completion.schedule,
    financialPercent: completion.financial,
    overallCompletion: completion.overall,
    onTrack: completion.onTrack,
    subs: extras.subs ?? [],
    divisions: extras.divisions ?? [],
    tasks: {
      total: completion.tasksTotal,
      done: completion.tasksDone,
      overdue: (extras.tasks ?? []).filter(
        (t) => t.dueDate && t.dueDate.getTime() < Date.now() && t.status !== 'DONE' && t.status !== 'CANCELLED',
      ).length,
      highPriority: (extras.tasks ?? []).filter(
        (t) => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'DONE' && t.status !== 'CANCELLED',
      ).length,
      unassigned: (extras.tasks ?? []).filter(
        (t) => !t.assignee && t.status !== 'DONE' && t.status !== 'CANCELLED',
      ).length,
      recent: (extras.tasks ?? []).slice(0, 8),
    },
    payApps: {
      total: project.payApps.length,
      sent: project.payApps.filter((p) => p.status === 'SENT' || p.status === 'VIEWED').length,
      paid: project.payApps.filter((p) => p.status === 'PAID').length,
      lastDrawDaysAgo: project.payApps[0]
        ? Math.floor((Date.now() - project.payApps[0].createdAt.getTime()) / 86_400_000)
        : null,
      lastDrawAmount: project.payApps[0] ? project.payApps[0].totalThisDraw : null,
    },
    hasOverduePermits: (extras.permits?.overdueCount ?? 0) > 0,
  };
}

const SYSTEM_PROMPT = `You are an expert construction project manager AI assistant.
You analyze project data for small-to-mid U.S. construction contractors
(residential + light commercial).

You are direct, specific, and use construction-industry language.
You always use the actual sub names, division codes, task titles, and
dollar amounts from the data. Never give generic advice like
"communicate with your team" — instead say "Call Acme Plumbing — their
rough-in is on the critical path and the slab pour is in 4 days."

When you give risks or opportunities, include the specific dollar
amount, day count, or task that triggers it. When you suggest a
next action, name the person to contact or the file to open.

Format: short, scannable. 1-2 sentences per item. Always return JSON
matching the requested schema exactly. No prose outside JSON.`;

const ANALYSIS_SCHEMA_HINT = `{
  "summary": "<2-3 sentence executive summary. Reference the actual sub names, division codes, or task counts from the data.>",
  "healthScore": <0-100 integer, where 100 = perfectly on track, 0 = crisis>,
  "risks": ["<specific risk 1>", "<specific risk 2>"],
  "opportunities": ["<specific opportunity 1>", "<specific opportunity 2>"],
  "nextActions": [
    { "title": "<action title>", "why": "<one sentence justification with names/numbers>", "href": "<relative path under /w/_/projects/_/>" }
  ]
}`;

const INSIGHTS_SCHEMA_HINT = `{
  "insights": [
    {
      "level": "success" | "warning" | "danger" | "info",
      "category": "financial" | "schedule" | "team" | "risk" | "opportunity" | "communication",
      "title": "<short title, 3-6 words>",
      "body": "<1-2 sentence explanation. MUST name a specific sub, division, task, or dollar amount.>"
    }
  ]
}`;

const SUB_MESSAGE_SCHEMA_HINT = `{
  "subject": "<5-8 word subject line>",
  "body": "<message body, 1-3 short paragraphs, plain text, construction crew-friendly tone, no formal letter format>",
  "confidence": <0-100 integer reflecting how well the draft fits the context>,
  "why": "<one sentence: why this message is the right thing to send right now>"
}`;

/**
 * Run a deep analysis pass. Returns null if DeepSeek isn't configured.
 */
export async function analyzeProjectDeep(
  project: ProjectMeta,
  workspaceSlug: string,
  projectId: string,
  extras: Parameters<typeof buildProjectContext>[2] = {},
): Promise<DeepAnalysis | null> {
  if (!isOpenRouterConfigured()) return null;

  const completion = computeProjectCompletion(project);
  const ctx = buildProjectContext(project, completion, extras);

  const userPrompt = `Analyze this construction project. Be specific — use the actual sub names, division codes, task titles, and dollar amounts from the data.

PROJECT DATA:
${JSON.stringify(ctx, null, 2)}

Return JSON with this exact structure:
${ANALYSIS_SCHEMA_HINT}

Base href for any actions: /w/${workspaceSlug}/projects/${projectId}
Use fragments like /tasks, /pay-apps, /subs, etc. for the action links.`;

  try {
    const result = await openrouterJson<{
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
      model: 'openrouter/nemotron-3.5-lightning',
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
  extras: Parameters<typeof buildProjectContext>[2] = {},
): Promise<DeepInsight[]> {
  if (!isOpenRouterConfigured()) return [];

  const completion = computeProjectCompletion(project);
  const ctx = buildProjectContext(project, completion, extras);

  const userPrompt = `Given this construction project data, identify 1-4 non-obvious insights
the rule-based system would miss. Look for things like:
- Cash flow issues (e.g. "draws sent 45+ days ago, AR aging risk")
- Bottlenecks in the team (e.g. "John has 12 open tasks — single point of failure")
- Coordination issues between subs and the schedule
- Early warning signs of disputes (e.g. "2 inspections overdue, permit risk")
- Division-specific patterns (e.g. "rough electrical at 80% but rough plumbing at 30% — likely a sequencing problem")

PROJECT DATA:
${JSON.stringify(ctx, null, 2)}

Return JSON:
${INSIGHTS_SCHEMA_HINT}

Base href for any action links: /w/${workspaceSlug}/projects/${projectId}`;

  try {
    const result = await openrouterJson<{ insights: DeepInsight[] }>(
      SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.6, maxTokens: 1200 },
    );
    return (result.insights ?? []).map((i) => ({ ...i, action: undefined }));
  } catch (e) {
    console.error('[DeepSeek] generateDeepInsights failed:', e);
    return [];
  }
}

/**
 * Draft a message to a specific subcontractor based on the current
 * project state, their assigned trades, and recent task activity.
 */
export async function draftSubMessage(
  project: ProjectMeta,
  workspaceSlug: string,
  sub: SubLite & { contactName?: string | null; phone?: string | null; email?: string | null },
  context: {
    trigger: 'manual' | 'rough-in-ready' | 'inspection-scheduled' | 'work-due' | 'change-order';
    notes?: string;
  },
): Promise<SubMessageDraft | null> {
  if (!isOpenRouterConfigured()) return null;

  const completion = computeProjectCompletion(project);

  const userPrompt = `Draft a short, construction-crew-friendly message from the project manager
to the sub named below. The project is "${project.name}".

The trigger for this message is: ${context.trigger}
${context.notes ? `\nAdditional context from the PM: ${context.notes}\n` : ''}

SUB INFO:
- Name: ${sub.name}
- Trade: ${sub.primaryTrade ?? 'general'}
- Status on this project: ${sub.status}
- Contract amount: $${sub.contractAmount?.toLocaleString() ?? '?'}
- Divisions assigned: ${sub.divisionLabels.length > 0 ? sub.divisionLabels.join(', ') : 'none on file'}

PROJECT STATE:
- Address: ${project.name} (${completion.daysRemaining ?? '?'} days remaining)
- Overall completion: ${completion.overall}%
- Financial: ${completion.financial}% billed
- Schedule: ${completion.schedule}% elapsed

TONE: Casual, direct, like texting a trusted sub. No formal letter format.
"Hi [name]," greeting is fine but optional. 1-3 short paragraphs.
Reference their actual assigned trades, not generic phrases.

Return JSON:
${SUB_MESSAGE_SCHEMA_HINT}`;

  try {
    const result = await openrouterJson<{
      subject: string;
      body: string;
      confidence: number;
      why: string;
    }>(SYSTEM_PROMPT, userPrompt, { temperature: 0.6, maxTokens: 600 });

    return {
      subject: result.subject,
      body: result.body,
      confidence: Math.max(0, Math.min(100, Math.round(result.confidence))),
      why: result.why,
      generatedAt: new Date().toISOString(),
    };
  } catch (e) {
    // Don't swallow — let the action surface the real error to
    // the user. console.error keeps it in Vercel logs for
    // debugging too.
    console.error('[OpenRouter] draftSubMessage failed:', e);
    throw e;
  }
}
