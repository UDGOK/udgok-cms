/**
 * Server-side read queries for the notification
 * system. The bell polls these on a timer, and the
 * panel renders their results.
 *
 * Authorization model: every query is scoped to the
 * calling user. A user can only see their own
 * notifications. There is no "view all workspace
 * notifications" endpoint in v1 (that's the audit
 * page, which lives elsewhere).
 */

import { prisma } from '@/lib/db/client';
import {
  NOTIFICATION_TYPES,
  type NotificationCounts,
  type NotificationType,
  type NotificationView,
  PANEL_LIMIT,
  PANEL_UNREAD_LIMIT,
} from './types';

/**
 * Narrow a Prisma row to the bell-panel view shape.
 * Centralised so the projection rules (date
 * formatting, createdBy shape) live in one place.
 */
function toView(row: {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: Date;
  readAt: Date | null;
  createdBy: { id: string; name: string | null } | null;
}): NotificationView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: NOTIFICATION_TYPES.includes(row.type as NotificationType)
      ? (row.type as NotificationType)
      : 'system',
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdBy: row.createdBy
      ? { id: row.createdBy.id, name: row.createdBy.name ?? 'Member' }
      : null,
  };
}

/**
 * Get the panel payload for a user. Returns unread
 * (capped at PANEL_UNREAD_LIMIT) + recently read
 * (capped at PANEL_LIMIT total). Excludes dismissed.
 *
 * We also return the unread count separately so the
 * bell can show a number > 20 (the panel only shows
 * the first 20 unread but the badge can read "99+").
 */
export async function getNotificationPanel(
  userId: string,
): Promise<{ unread: NotificationView[]; earlier: NotificationView[]; counts: NotificationCounts }> {
  const [unreadRows, earlierRows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        recipientId: userId,
        readAt: null,
        dismissedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: PANEL_UNREAD_LIMIT,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.notification.findMany({
      where: {
        recipientId: userId,
        readAt: { not: null },
        dismissedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: PANEL_LIMIT,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.notification.count({
      where: {
        recipientId: userId,
        readAt: null,
        dismissedAt: null,
      },
    }),
  ]);

  return {
    unread: unreadRows.map(toView),
    earlier: earlierRows.map(toView),
    counts: { unread: unreadCount },
  };
}

/**
 * Lightweight poll endpoint for the bell badge. Just
 * the unread count. The panel fetch is heavier
 * (joins createdBy, projects 50 rows) so the bell
 * only fetches the full panel on demand (when the
 * user opens the dropdown) and on a slower interval
 * while the panel is open.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId: userId,
      readAt: null,
      dismissedAt: null,
    },
  });
}
