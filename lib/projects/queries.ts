import { prisma } from '@/lib/db/client';

export async function listProjects(workspaceId: string, take = 100) {
  return prisma.project.findMany({
    where: { workspaceId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take,
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { divisions: true, payApps: true, tasks: true } },
    },
  });
}

export async function getProject(workspaceId: string, id: string) {
  return prisma.project.findFirst({
    where: { id, workspaceId },
    include: {
      client: true,
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      divisions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          subLinks: {
            include: {
              assignment: { include: { subcontractor: true } },
            },
          },
        },
      },
      payApps: {
        orderBy: { drawNumber: 'desc' },
        include: { divisions: true },
      },
      subAssignments: {
        orderBy: { createdAt: 'desc' },
        include: {
          subcontractor: true,
          divisionLinks: {
            include: { division: { select: { id: true, code: true, trade: true } } },
          },
        },
      },
      // All tasks (gantt subset below). Full task list for the Tasks tab.
      tasks: {
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      files: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
}

export async function listProjectTasks(workspaceId: string, projectId: string) {
  return prisma.task.findMany({
    where: { workspaceId, projectId },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function listProjectMembers(workspaceId: string, projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId, project: { workspaceId } },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, email: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function listWorkspaceMembersForAdd(workspaceId: string) {
  return prisma.membership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  });
}
