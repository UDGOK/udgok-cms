import { prisma } from '@/lib/db/client';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export async function listTasks(workspaceId: string, take = 200) {
  return prisma.task.findMany({
    where: { workspaceId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take,
    include: {
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });
}

export async function myTasks(userId: string, workspaceId: string) {
  return prisma.task.findMany({
    where: { workspaceId, assigneeId: userId, status: { not: 'DONE' } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: 20,
  });
}
