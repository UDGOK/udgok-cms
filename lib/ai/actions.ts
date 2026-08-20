'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getProjectWithRelations, computeProjectCompletion, type ProjectMeta } from '@/lib/projects/insights';
import { ProjectStatus } from '@prisma/client';
import { draftSubMessage } from '@/lib/ai/project-analyzer';
import { isOpenRouterConfigured } from '@/lib/ai/openrouter';

interface SubLite {
  id: string;
  name: string;
  primaryTrade: string | null;
  status: string;
  contractAmount: number | null;
  divisionLabels: string[];
}

async function loadProjectContext(workspaceSlug: string, projectId: string) {
  const workspaceRow = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspaceRow) return null;

  const project = await getProjectWithRelations(workspaceRow.id, projectId);
  if (!project) return null;

  // The Prisma return type is occasionally narrower than
  // the include claims after schema migrations. Cast once
  // so the rest of the function can read divisions, tasks,
  // payApps, etc. without TS errors.
  const p = project as unknown as {
    id: string;
    name: string;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    contractValue: { toString(): string } | number | null;
    divisions: { id: string; budget: { toString(): string } | number }[];
    payApps: Array<{ id: string; status: string; totalThisDraw: { toString(): string } | number; totalContract: { toString(): string } | number; totalPrevious: { toString(): string } | number; periodStart: Date; periodEnd: Date; createdAt: Date }>;
    tasks: { id: string; status: string; priority: string; dueDate: Date | null; startDate: Date | null; endDate: Date | null; title: string; assignee: { id: string; name: string | null } | null }[];
    subAssignments: {
      status: string;
      contractAmount: { toString(): string } | number;
      subcontractor: { id: string; name: string; primaryTrade: string | null };
      divisionLinks: { division: { code: string; trade: string | null } }[];
    }[];
  };

  const completion = computeProjectCompletion({
    id: p.id,
    name: p.name,
    status: p.status as Parameters<typeof computeProjectCompletion>[0]['status'],
    startDate: p.startDate,
    endDate: p.endDate,
    contractValue: p.contractValue ? Number(p.contractValue) : null,
    divisions: p.divisions.map((d) => ({ id: d.id, budget: Number(d.budget), payAppLines: [] })),
    payApps: [],
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
  });

  const projectMeta: ProjectMeta = {
    id: p.id,
    name: p.name,
    status: p.status as ProjectStatus,
    startDate: p.startDate,
    endDate: p.endDate,
    contractValue: p.contractValue ? Number(p.contractValue) : null,
    divisions: p.divisions.map((d) => ({
      id: d.id,
      budget: Number(d.budget),
      payAppLines: [],
    })),
    payApps: (p.payApps as Array<{ id: string; status: string; totalThisDraw: { toString(): string } | number; totalContract: { toString(): string } | number; totalPrevious: { toString(): string } | number; periodStart: Date; periodEnd: Date; createdAt: Date }>).map((pay) => ({
      id: pay.id,
      status: pay.status,
      totalThisDraw: Number(pay.totalThisDraw),
      totalContract: Number(pay.totalContract),
      totalPrevious: Number(pay.totalPrevious),
      periodStart: pay.periodStart,
      periodEnd: pay.periodEnd,
      createdAt: pay.createdAt,
      divisions: [],
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

  return { project: p, projectMeta, completion };
}

export async function draftSubMessageAction(
  workspaceSlug: string,
  projectId: string,
  subId: string,
  opts: { trigger: 'manual' | 'rough-in-ready' | 'inspection-scheduled' | 'work-due' | 'change-order'; notes?: string },
): Promise<{ ok: boolean; draft?: { subject: string; body: string; confidence: number; why: string }; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  if (!isOpenRouterConfigured()) return { ok: false, error: 'AI not configured' };

  const ctx = await loadProjectContext(workspaceSlug, projectId);
  if (!ctx) return { ok: false, error: 'Project not found' };

  const subAssignment = ctx.project.subAssignments.find((a) => a.subcontractor.id === subId);
  if (!subAssignment) return { ok: false, error: 'Sub not assigned to this project' };

  const sub: SubLite = {
    id: subAssignment.subcontractor.id,
    name: subAssignment.subcontractor.name,
    primaryTrade: subAssignment.subcontractor.primaryTrade,
    status: subAssignment.status,
    // contractAmount is on the ProjectSubcontractorAssignment
    // (the relation), not on the Subcontractor itself.
    contractAmount: subAssignment.contractAmount
      ? Number(subAssignment.contractAmount)
      : null,
    divisionLabels: subAssignment.divisionLinks.map((dl) => `${dl.division.code} ${dl.division.trade}`),
  };

  let draft;
  try {
    draft = await draftSubMessage(ctx.projectMeta, workspaceSlug, { ...sub }, opts);
  } catch (e) {
    // Surface the actual failure to the user. The previous version
    // returned a generic "Failed to generate draft" which hid
    // everything — was the env var unset, the model down, a
    // malformed response? Now the user sees what actually went
    // wrong so they can retry, copy for support, or try a
    // different model.
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[draftSubMessageAction] AI call failed:', msg);
    return {
      ok: false,
      error: `AI service is unavailable right now. ${msg.slice(0, 280)}`,
    };
  }
  if (!draft) return { ok: false, error: 'AI returned no draft — try again' };
  return { ok: true, draft };
}
