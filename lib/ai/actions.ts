'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getProjectWithRelations, computeProjectCompletion, type ProjectMeta } from '@/lib/projects/insights';
import { draftSubMessage } from '@/lib/ai/project-analyzer';
import { isNvidiaConfigured } from '@/lib/ai/nvidia';

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

  const projectMeta: ProjectMeta = {
    id: project.id,
    name: project.name,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    contractValue: project.contractValue ? Number(project.contractValue) : null,
    divisions: project.divisions.map((d) => ({
      id: d.id,
      budget: Number(d.budget),
      payAppLines: [],
    })),
    payApps: project.payApps.map((p) => ({
      id: p.id,
      status: p.status,
      totalThisDraw: Number(p.totalThisDraw),
      totalContract: Number(p.totalContract),
      totalPrevious: Number(p.totalPrevious),
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      createdAt: p.createdAt,
      divisions: [],
    })),
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
  };

  return { project, projectMeta, completion };
}

export async function draftSubMessageAction(
  workspaceSlug: string,
  projectId: string,
  subId: string,
  opts: { trigger: 'manual' | 'rough-in-ready' | 'inspection-scheduled' | 'work-due' | 'change-order'; notes?: string },
): Promise<{ ok: boolean; draft?: { subject: string; body: string; confidence: number; why: string }; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  if (!isNvidiaConfigured()) return { ok: false, error: 'AI not configured' };

  const ctx = await loadProjectContext(workspaceSlug, projectId);
  if (!ctx) return { ok: false, error: 'Project not found' };

  const subAssignment = ctx.project.subAssignments.find((a) => a.subcontractor.id === subId);
  if (!subAssignment) return { ok: false, error: 'Sub not assigned to this project' };

  const sub: SubLite = {
    id: subAssignment.subcontractor.id,
    name: subAssignment.subcontractor.name,
    primaryTrade: subAssignment.subcontractor.primaryTrade,
    status: subAssignment.status,
    contractAmount: subAssignment.contractAmount ? Number(subAssignment.contractAmount) : null,
    divisionLabels: subAssignment.divisionLinks.map((dl) => `${dl.division.code} ${dl.division.trade}`),
  };

  const draft = await draftSubMessage(ctx.projectMeta, workspaceSlug, { ...sub }, opts);
  if (!draft) return { ok: false, error: 'Failed to generate draft' };
  return { ok: true, draft };
}
