import { prisma } from '@/lib/db/client';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'sent'
  | 'viewed'
  | 'acknowledged'
  | 'paid'
  | 'disputed'
  | 'assigned'
  | 'unassigned'
  | 'invited'
  | 'joined'
  | 'left'
  | 'imported'
  | 'exported'
  | 'regenerated';

export type ActivityEntityType =
  | 'client'
  | 'project'
  | 'pay_app'
  | 'subcontractor'
  | 'task'
  | 'team'
  | 'workspace'
  | 'member'
  | 'note'
  | 'file'
  | 'division'
  | 'comment'
  | 'message';

interface LogOptions {
  workspaceId: string;
  actorId?: string | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityName?: string | null;
  details?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an entry to the workspace activity log. Safe to call from any
 * server action or API route. Errors are caught silently so logging
 * never breaks the primary operation.
 */
export async function logActivity(opts: LogOptions): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        workspaceId: opts.workspaceId,
        actorId: opts.actorId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        entityName: opts.entityName ?? null,
        details: opts.details,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: opts.metadata as any,
      },
    });
  } catch (err) {
    // Logging must never break the caller. Console only.
    // eslint-disable-next-line no-console
    console.error('[activity] failed to write log:', err);
  }
}
