import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { prisma } from '@/lib/db/client';
import { computeProjectCompletion } from '@/lib/projects/insights';
import { deepseekJson, isDeepSeekConfigured } from '@/lib/ai/deepseek';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ai/chat
 * Body: { projectId, message }
 *
 * Returns a single assistant reply (no streaming to keep it simple).
 * The conversation is in-memory only (lost on refresh) — fine for
 * "ask once and act" usage, and avoids building a full chat thread
 * storage system right now.
 *
 * The user must be a member of the project workspace. Master admins
 * can also use this endpoint without workspace membership.
 */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!isDeepSeekConfigured()) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  const body = (await req.json()) as { projectId?: string; message?: string; history?: ChatMessage[] };
  if (!body.projectId || !body.message) {
    return NextResponse.json({ error: 'projectId and message are required' }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: body.projectId },
    include: {
      workspace: { select: { id: true, name: true, slug: true, members: { where: { userId }, select: { id: true } } } },
      client: { select: { name: true } },
      divisions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          payAppLines: true,
          subLinks: { include: { assignment: { include: { subcontractor: { select: { name: true, primaryTrade: true } } } } } },
        },
      },
      payApps: { orderBy: { drawNumber: 'desc' }, include: { divisions: true } },
      subAssignments: {
        include: {
          subcontractor: { select: { id: true, name: true, primaryTrade: true } },
          divisionLinks: { include: { division: { select: { id: true, code: true, trade: true } } } },
        },
      },
      tasks: {
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        take: 100,
        include: { assignee: { select: { name: true } } },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const master = await isMasterAdmin(userId);
  const isMember = project.workspace.members.length > 0;
  if (!master && !isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build a tight, factual project context
  const totalBilled = project.payApps.reduce(
    (acc, p) => acc + Number(p.totalThisDraw),
    0,
  );
  const totalBudget = project.divisions.reduce((acc, d) => acc + Number(d.budget), 0);
  const billedByDivision = new Map<string, number>();
  for (const payApp of project.payApps) {
    for (const line of payApp.divisions) {
      billedByDivision.set(
        line.projectDivisionId,
        (billedByDivision.get(line.projectDivisionId) ?? 0) + Number(line.thisDrawAmount),
      );
    }
  }

  const overdueTasks = project.tasks.filter(
    (t) => t.dueDate && t.dueDate.getTime() < Date.now() && t.status !== 'DONE' && t.status !== 'CANCELLED',
  );
  const openTasks = project.tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');

  const context = {
    project: {
      name: project.name,
      code: project.code,
      status: project.status,
      client: project.client?.name ?? null,
      address: [project.address, project.city, project.state, project.zip].filter(Boolean).join(', ') || null,
      contractValue: project.contractValue ? Number(project.contractValue) : null,
      startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
    },
    financials: {
      totalBudget,
      totalBilled,
      remaining: (project.contractValue ? Number(project.contractValue) : totalBudget) - totalBilled,
      payAppCount: project.payApps.length,
      lastPayApp: project.payApps[0]
        ? {
            number: project.payApps[0].drawNumber,
            amount: Number(project.payApps[0].totalThisDraw),
            status: project.payApps[0].status,
            daysAgo: Math.floor((Date.now() - project.payApps[0].createdAt.getTime()) / 86_400_000),
          }
        : null,
    },
    divisions: project.divisions.map((d) => ({
      code: d.code,
      trade: d.trade,
      budget: Number(d.budget),
      billed: billedByDivision.get(d.id) ?? 0,
      remaining: Number(d.budget) - (billedByDivision.get(d.id) ?? 0),
      sub: d.subLinks?.[0]?.assignment?.subcontractor?.name ?? null,
    })),
    subs: project.subAssignments.map((a) => ({
      name: a.subcontractor.name,
      trade: a.subcontractor.primaryTrade,
      status: a.status,
      contract: Number(a.contractAmount),
      divisions: a.divisionLinks.map((dl) => `${dl.division.code} ${dl.division.trade}`),
    })),
    tasks: {
      total: project.tasks.length,
      open: openTasks.length,
      overdue: overdueTasks.length,
      byStatus: {
        TODO: project.tasks.filter((t) => t.status === 'TODO').length,
        IN_PROGRESS: project.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        BLOCKED: project.tasks.filter((t) => t.status === 'BLOCKED').length,
        DONE: project.tasks.filter((t) => t.status === 'DONE').length,
      },
      openList: openTasks.slice(0, 30).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        due: t.dueDate?.toISOString().slice(0, 10) ?? null,
        assignee: t.assignee?.name ?? null,
      })),
    },
  };

  const completion = computeProjectCompletion({
    id: project.id,
    name: project.name,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    contractValue: project.contractValue ? Number(project.contractValue) : null,
    divisions: project.divisions.map((d) => ({ id: d.id, budget: Number(d.budget), payAppLines: [] })),
    payApps: [],
    tasks: project.tasks.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      startDate: t.startDate,
      endDate: t.endDate,
      title: t.title,
      assignee: t.assignee,
    })),
    subAssignments: project.subAssignments.map((a) => ({ status: a.status })),
  });

  const systemMessage = `You are UDGOK AI, a project management assistant for a U.S. construction contractor.
The user is asking you about one of their projects. You have full, real-time access to the project's data below.

You give short, direct, specific answers. You use the actual sub names, division codes, and dollar amounts.
You don't hedge with "I cannot access" — the data is in front of you.
If the user asks a general question, anchor your answer in this project's actual numbers.

PROJECT COMPLETION: ${completion.overall}% overall (${completion.financial}% financial, ${completion.tasks}% tasks)

PROJECT DATA (JSON):
${JSON.stringify(context, null, 2)}

Answer the user's question. Be specific. Use bullet points when listing things. Keep it under 300 words unless the user asks for detail.`;

  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-10)
    : [];

  const messages: ChatMessage[] = [
    { role: 'system', content: systemMessage },
    ...history,
    { role: 'user', content: body.message },
  ];

  try {
    const result = await deepseekJson<{ answer: string }>(
      'You are UDGOK AI, a project management assistant. Be direct, specific, use the actual data. Always return JSON with an "answer" key containing your response in plain text (no markdown, but bullets and line breaks are fine).',
      messages.map((m) => m.content).join('\n\n'),
      { temperature: 0.5, maxTokens: 800 },
    );
    return NextResponse.json({ answer: result.answer ?? '(no answer)' });
  } catch (e) {
    console.error('[AI chat] failed:', e);
    return NextResponse.json({ error: 'AI call failed' }, { status: 500 });
  }
}
