'use server';

/**
 * Server actions for the notification system.
 *
 * Three user-facing actions:
 *   - markRead: mark one or all of the caller's
 *               notifications as read.
 *   - dismiss: dismiss one notification (hides it
 *              from the panel).
 *   - push:    push a new notification. Fanned out
 *              to one row per recipient. Caller
 *              must be OWNER / ADMIN / PM / FIELD
 *              in the workspace.
 *
 * Plus one internal helper:
 *   - emit:    called by other server actions (e.g.
 *              toggleCheckInAction) to auto-generate
 *              a notification. Bypasses the role
 *              check because the caller is the
 *              system, not a user.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import {
  NOTIFICATION_TYPES,
  PUSH_ROLES,
  type NotificationType,
  type PushRecipientScope,
} from './types';

// =====================================================================
// Result types — used by the form actions to return either a success
// or a structured error. The client maps the error to a toast.
// =====================================================================

export type NotificationActionResult =
  | { ok: true }
  | { ok: false; error: string };

// =====================================================================
// markRead
// =====================================================================

const markReadSchema = z.object({
  // Either provide a single id or set all=true.
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
});

/**
 * Mark one notification (by id) or all of the
 * caller's notifications as read. Only the
 * caller's own notifications can be marked
 * read — the where-clause pins recipientId
 * to the caller.
 */
export async function markReadAction(
  formData: FormData,
): Promise<NotificationActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = markReadSchema.safeParse({
    id: (formData.get('id') as string | null) || undefined,
    all: formData.get('all') === 'true',
  });
  if (!parsed.success) {
    return { ok: false, error: 'Invalid request' };
  }

  if (parsed.data.id) {
    // Mark a single row. Pin to recipientId so a
    // crafted id can't mark someone else's row.
    const result = await prisma.notification.updateMany({
      where: {
        id: parsed.data.id,
        recipientId: userId,
      },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      return { ok: false, error: 'Notification not found' };
    }
  } else if (parsed.data.all) {
    // Mark all of the caller's unread as read. The
    // where-clause skips already-read rows (which
    // would be a no-op anyway) and dismissed rows
    // (which the user explicitly hid).
    await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        readAt: null,
        dismissedAt: null,
      },
      data: { readAt: new Date() },
    });
  } else {
    return { ok: false, error: 'Provide id or all=true' };
  }

  revalidatePath('/w/[workspace]', 'layout');
  return { ok: true };
}

// =====================================================================
// dismiss
// =====================================================================

const dismissSchema = z.object({
  id: z.string().min(1),
});

/**
 * Dismiss a single notification. Pinned to the
 * caller so a crafted id can't dismiss someone
 * else's row. Dismiss is distinct from read —
 * dismissed rows are hidden from the panel
 * entirely (the "see all" view in a follow-up
 * can show them).
 */
export async function dismissNotificationAction(
  formData: FormData,
): Promise<NotificationActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = dismissSchema.safeParse({
    id: formData.get('id'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Invalid request' };
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: parsed.data.id,
      recipientId: userId,
    },
    data: { dismissedAt: new Date() },
  });
  if (result.count === 0) {
    return { ok: false, error: 'Notification not found' };
  }

  revalidatePath('/w/[workspace]', 'layout');
  return { ok: true };
}

// =====================================================================
// push
// =====================================================================

const pushSchema = z.object({
  workspaceSlug: z.string().min(1),
  type: z.enum(NOTIFICATION_TYPES as unknown as [string, ...string[]]),
  title: z.string().min(1, 'Title is required').max(120, 'Title too long'),
  body: z.string().max(500, 'Body too long').optional(),
  link: z.string().max(500).optional(),
  recipientScope: z.string().min(1), // JSON: PushRecipientScope
});

/**
 * Push a notification. The scope field is a JSON
 * string because server actions need primitives;
 * we parse + validate on the server.
 *
 * Returns the number of recipients the alert was
 * sent to so the compose modal can show "Sent to 8
 * members" confirmation.
 */
export async function pushNotificationAction(
  _prev: PushResult | undefined,
  formData: FormData,
): Promise<PushResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = pushSchema.safeParse({
    workspaceSlug: formData.get('workspaceSlug'),
    type: formData.get('type'),
    title: (formData.get('title') as string | null)?.trim(),
    body: (formData.get('body') as string | null)?.trim() || undefined,
    link: (formData.get('link') as string | null)?.trim() || undefined,
    recipientScope: formData.get('recipientScope'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return {
      ok: false,
      error: 'Please fix the errors below',
      fieldErrors,
    };
  }

  // Parse the recipient scope. We re-validate the
  // shape here so a crafted formData can't sneak
  // through with a malformed object.
  let scope: PushRecipientScope;
  try {
    const raw = JSON.parse(parsed.data.recipientScope) as unknown;
    if (
      raw &&
      typeof raw === 'object' &&
      'kind' in raw &&
      (raw as { kind: string }).kind === 'all'
    ) {
      scope = { kind: 'all' };
    } else if (
      raw &&
      typeof raw === 'object' &&
      'kind' in raw &&
      (raw as { kind: string }).kind === 'role' &&
      'role' in raw &&
      typeof (raw as { role: unknown }).role === 'string' &&
      (PUSH_ROLES as readonly string[]).includes(
        (raw as { role: string }).role,
      )
    ) {
      scope = {
        kind: 'role',
        role: (raw as { role: 'OWNER' | 'ADMIN' | 'PM' | 'FIELD' }).role,
      };
    } else {
      return { ok: false, error: 'Invalid recipient scope' };
    }
  } catch {
    return { ok: false, error: 'Invalid recipient scope' };
  }

  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  await requireRole(workspace.id, [...PUSH_ROLES]);

  // Resolve the recipient userIds.
  const memberships = await prisma.membership.findMany({
    where: {
      workspaceId: workspace.id,
      ...(scope.kind === 'role' ? { role: scope.role } : {}),
    },
    select: { userId: true },
  });
  const recipientIds = Array.from(new Set(memberships.map((m) => m.userId)));
  // Don't send to the pusher themselves. They just
  // sent it; they don't need their own copy in the
  // bell.
  const filtered = recipientIds.filter((id) => id !== userId);
  if (filtered.length === 0) {
    return { ok: false, error: 'No recipients in that scope' };
  }

  // Fan out. createMany is one round-trip; we
  // don't need the returned rows.
  await prisma.notification.createMany({
    data: filtered.map((recipientId) => ({
      workspaceId: workspace.id,
      recipientId,
      createdById: userId,
      type: parsed.data.type,
      category: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      link: parsed.data.link ?? null,
    })),
  });

  // Note: we intentionally don't write an ActivityLog
  // row here. ActivityLog.entityId points at a single
  // entity, but a broadcast is a fan-out — there is no
  // single entity to point at. The Notification rows
  // themselves are the audit. A future "sent alerts"
  // view can query Notification where createdById =
  // self and group by metadata.

  revalidatePath('/w/[workspace]', 'layout');
  return { ok: true, recipientCount: filtered.length };
}

export type PushResult =
  | { ok: true; recipientCount: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// =====================================================================
// emit (internal helper — for auto-events like check-ins)
// =====================================================================

/**
 * Internal helper used by other server actions
 * (e.g. toggleCheckInAction) to auto-generate
 * a notification. Bypasses the role check
 * because the caller is a server action, not a
 * user.
 *
 * `recipientResolver` returns the userIds that
 * should receive the notification. We give the
 * caller flexibility on who gets pinged (e.g.
 * check-in pings PMs of the project, task
 * assigned pings the assignee, pay-app submitted
 * pings the approver). Returns the number of
 * rows created.
 */
export async function emitNotification(args: {
  workspaceId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  recipientIds: string[];
  metadata?: Record<string, unknown>;
  createdById?: string | null;
}): Promise<{ count: number }> {
  // Dedupe and drop null/empty.
  const recipients = Array.from(new Set(args.recipientIds.filter(Boolean)));
  if (recipients.length === 0) return { count: 0 };

  await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({
      workspaceId: args.workspaceId,
      recipientId,
      createdById: args.createdById ?? null,
      type: args.type,
      category: args.type,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
      metadata: args.metadata ? JSON.stringify(args.metadata) : null,
    })),
  });

  return { count: recipients.length };
}
