'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

import { DEFAULT_SOV_TEMPLATE } from '@/lib/construction/csi-masterformat';

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(40).optional(),
  clientId: z.string().optional(),
  description: z.string().max(4000).optional(),
  contractValue: z.coerce.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  seedTemplate: z.union([z.literal('on'), z.literal('true'), z.literal('1')]).optional(),
});

export type CreateProjectState =
  | { error?: string; fieldErrors?: Record<string, string>; id?: string }
  | undefined;

export async function createProjectAction(
  workspaceSlug: string,
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = projectSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code') || undefined,
    clientId: formData.get('clientId') || undefined,
    description: formData.get('description') || undefined,
    contractValue: formData.get('contractValue') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
    seedTemplate: formData.get('seedTemplate') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Compute the default SOV line budgets from the contract value + template %
  const contractValue = parsed.data.contractValue ?? 0;
  const template = parsed.data.seedTemplate ? DEFAULT_SOV_TEMPLATE : [];

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      code: parsed.data.code,
      clientId: parsed.data.clientId,
      description: parsed.data.description,
      contractValue: parsed.data.contractValue,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    },
    select: { id: true },
  });

  // Seed the standard SOV template if the user opted in
  if (template.length > 0) {
    const lines = template.map((t, i) => ({
      projectId: project.id,
      code: t.code,
      trade: t.trade,
      budget: Math.round(contractValue * (t.pctOfBudget / 100) * 100) / 100,
      sortOrder: i + 1,
    }));
    // Fix rounding drift: add the difference to the last line so total = contract
    const totalFromTemplate = lines.reduce((acc, l) => acc + l.budget, 0);
    const drift = Math.round((contractValue - totalFromTemplate) * 100) / 100;
    if (lines.length > 0 && Math.abs(drift) >= 0.01) {
      lines[lines.length - 1].budget = Math.round((lines[lines.length - 1].budget + drift) * 100) / 100;
    }
    await prisma.projectDivision.createMany({ data: lines });
  }

  revalidatePath(`/w/${workspaceSlug}/projects`);
  return { id: project.id };
}

const divisionSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  trade: z.string().min(1, 'Trade is required').max(120),
  subcontractorName: z.string().max(120).optional(),
  budget: z.coerce.number().min(0),
});

export type CreateDivisionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function createDivisionAction(
  workspaceSlug: string,
  projectId: string,
  _prev: CreateDivisionState,
  formData: FormData,
): Promise<CreateDivisionState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  // Verify project belongs to this workspace
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = divisionSchema.safeParse({
    code: formData.get('code'),
    trade: formData.get('trade'),
    subcontractorName: formData.get('subcontractorName') || undefined,
    budget: formData.get('budget'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const lastSort = await prisma.projectDivision.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });

  await prisma.projectDivision.create({
    data: {
      projectId,
      code: parsed.data.code,
      trade: parsed.data.trade,
      subcontractorName: parsed.data.subcontractorName,
      budget: parsed.data.budget,
      sortOrder: (lastSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// PROJECT DETAILS (address, status, etc.)
// =========================================

const updateProjectDetailsSchema = z.object({
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  zip: z.string().max(20).optional(),
  description: z.string().max(4000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  contractValue: z.coerce.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
});

export type UpdateProjectDetailsState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function updateProjectDetailsAction(
  workspaceSlug: string,
  projectId: string,
  _prev: UpdateProjectDetailsState,
  formData: FormData,
): Promise<UpdateProjectDetailsState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = updateProjectDetailsSchema.safeParse({
    address: formData.get('address') ?? undefined,
    city: formData.get('city') ?? undefined,
    state: formData.get('state') ?? undefined,
    zip: formData.get('zip') ?? undefined,
    description: formData.get('description') ?? undefined,
    startDate: formData.get('startDate') ?? undefined,
    endDate: formData.get('endDate') ?? undefined,
    contractValue: formData.get('contractValue') ?? undefined,
    status: formData.get('status') ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      description: parsed.data.description,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      contractValue: parsed.data.contractValue,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// PROJECT TEAM (members involved)
// =========================================

const addMemberSchema = z.object({
  userId: z.string().min(1, 'Pick a teammate'),
  role: z.string().max(80).optional(),
});

export type AddProjectMemberState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function addProjectMemberAction(
  workspaceSlug: string,
  projectId: string,
  _prev: AddProjectMemberState,
  formData: FormData,
): Promise<AddProjectMemberState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = addMemberSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Verify user is a workspace member
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: parsed.data.userId, workspaceId: workspace.id } },
  });
  if (!membership) return { error: 'User is not a member of this workspace' };

  // Idempotent — upsert by (projectId, userId) unique constraint
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: parsed.data.userId } },
    update: { role: parsed.data.role || null },
    create: {
      projectId,
      userId: parsed.data.userId,
      role: parsed.data.role || null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function removeProjectMemberAction(
  workspaceSlug: string,
  projectId: string,
  userId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// PROJECT TASKS (in-page CRUD)
// =========================================

const projectTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']).default('TODO'),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

export type CreateProjectTaskState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function createProjectTaskAction(
  workspaceSlug: string,
  projectId: string,
  _prev: CreateProjectTaskState,
  formData: FormData,
): Promise<CreateProjectTaskState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = projectTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    priority: formData.get('priority') || 'NORMAL',
    status: formData.get('status') || 'TODO',
    dueDate: formData.get('dueDate') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: parsed.data.status,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      assigneeId: parsed.data.assigneeId || null,
      createdById: userId,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function updateProjectTaskStatusAction(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
  status: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const valid = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
  if (!valid.includes(status)) return { error: 'Invalid status' };

  const result = await prisma.task.updateMany({
    where: { id: taskId, projectId, workspaceId: workspace.id },
    data: { status: status as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED' },
  });
  if (result.count === 0) return { error: 'Task not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function deleteProjectTaskAction(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const result = await prisma.task.deleteMany({
    where: { id: taskId, projectId, workspaceId: workspace.id },
  });
  if (result.count === 0) return { error: 'Task not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}
