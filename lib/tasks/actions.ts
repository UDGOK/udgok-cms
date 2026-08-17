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
