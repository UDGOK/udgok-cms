'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  dealId: z.string().optional(),
});

export type CreateTaskState =
  | { error?: string; fieldErrors?: Record<string, string>; id?: string }
  | undefined;

export async function createTaskAction(
  workspaceSlug: string,
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return { error: 'Workspace not found' };
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const parsed = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    priority: formData.get('priority') || 'NORMAL',
    dueDate: formData.get('dueDate') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
    projectId: formData.get('projectId') || undefined,
    clientId: formData.get('clientId') || undefined,
    dealId: formData.get('dealId') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const task = await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assigneeId: parsed.data.assigneeId,
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      dealId: parsed.data.dealId,
      createdById: userId,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/tasks`);
  return { id: task.id };
}

export async function setTaskStatus(taskId: string, status: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });
  if (!task) return { error: 'Task not found' };
  await requireRole(task.workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);
  if (!['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'].includes(status)) {
    return { error: 'Invalid status' };
  }
  await prisma.task.update({ where: { id: taskId }, data: { status: status as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED' } });
  revalidatePath('/w');
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────
//  Update an existing task — title, description, priority, due date,
//  assignee, project, client. Status changes go through setTaskStatus
//  (which is wired to the column buttons on the task board).
// ───────────────────────────────────────────────────────────────────

const updateTaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

export type UpdateTaskState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function updateTaskAction(
  workspaceSlug: string,
  _prev: UpdateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return { error: 'Workspace not found' };

  // Tenant-scope the task lookup. Don't trust the taskId
  // from the client without the workspace check.
  const parsed = updateTaskSchema.safeParse({
    taskId: formData.get('taskId'),
    title: formData.get('title'),
    description: formData.get('description') || null,
    priority: formData.get('priority') || 'NORMAL',
    dueDate: formData.get('dueDate') || null,
    assigneeId: formData.get('assigneeId') || null,
    projectId: formData.get('projectId') || null,
    clientId: formData.get('clientId') || null,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Confirm the task belongs to this workspace before update.
  const existing = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, workspaceId: workspace.id },
    select: { id: true, createdById: true },
  });
  if (!existing) return { error: 'Task not found' };

  // Anyone on the workspace can edit (consistent with the
  // current role gate on createTaskAction). Tighten if needed.
  try {
    await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Forbidden' };
  }

  await prisma.task.update({
    where: { id: parsed.data.taskId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assigneeId: parsed.data.assigneeId ?? null,
      projectId: parsed.data.projectId ?? null,
      clientId: parsed.data.clientId ?? null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/tasks`);
  return { ok: true };
}
