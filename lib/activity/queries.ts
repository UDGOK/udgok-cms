import { prisma } from '@/lib/db/client';

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  details: string | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export async function listWorkspaceActivity(
  workspaceId: string,
  take = 50,
): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    entityName: r.entityName,
    details: r.details,
    createdAt: r.createdAt,
    actor: r.actor,
  }));
}

export async function listEntityActivity(
  workspaceId: string,
  entityType: string,
  entityId: string,
  take = 50,
): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    where: { workspaceId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    entityName: r.entityName,
    details: r.details,
    createdAt: r.createdAt,
    actor: r.actor,
  }));
}
