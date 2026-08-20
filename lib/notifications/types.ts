/**
 * Shared types for the notification system. The bell
 * dropdown, the API routes, and the server actions all
 * agree on these shapes.
 *
 * Why types live here (and not in actions.ts or the
 * Prisma client): the bell renders on the client, the
 * API serializes over the wire, the actions enforce
 * permissions server-side. They all need to share
 * field names without a circular import.
 */

/**
 * The high-level notification types. Keep this list
 * small and intentional — every new type means a new
 * icon + colour in the panel, which is a UI cost.
 *
 *   "team_push" — leader pushed an alert via the
 *                 compose modal. Always human-sourced.
 *   "checkin"   — someone checked in to a project.
 *                 Auto-generated.
 *   "pay_app"   — pay app status change (approved,
 *                 denied, submitted). Auto-generated.
 *                 (Reserved — not yet emitting.)
 *   "task"      — task assignment or status change.
 *                 Auto-generated. (Reserved.)
 *   "project"   — project created or status change.
 *                 Auto-generated. (Reserved.)
 *   "system"    — generic system message. Catch-all
 *                 for one-off platform messages.
 */
export type NotificationType =
  | 'team_push'
  | 'checkin'
  | 'pay_app'
  | 'task'
  | 'project'
  | 'system';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'team_push',
  'checkin',
  'pay_app',
  'task',
  'project',
  'system',
];

/**
 * The shape the bell panel consumes. This is the
 * "card" view — narrow projection of the full row
 * so the panel payload stays small (the bell polls
 * frequently, and the full row includes metadata
 * JSON that the panel doesn't need).
 */
export interface NotificationView {
  id: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string; // ISO
  readAt: string | null;
  createdBy: { id: string; name: string } | null;
}

/**
 * Counts the bell needs to render the badge. Two
 * numbers: total unread, and a boolean for "is there
 * anything pinned / new" so the badge can pulse on
 * change. Total unread is enough for the visible
 * number; the boolean is implicit (count > 0).
 */
export interface NotificationCounts {
  unread: number;
}

/**
 * Permissions for who can push a notification.
 * Mirrors the role gates in lib/auth/require-role.ts.
 * FIELD is included because field workers can ping
 * each other ("material just arrived", "site closed
 * for weather") without involving PMs.
 */
export const PUSH_ROLES = ['OWNER', 'ADMIN', 'PM', 'FIELD'] as const;
export type PushRole = (typeof PUSH_ROLES)[number];

/**
 * When a leader picks "send to..." in the compose
 * modal, the options are:
 *   - all: every workspace member
 *   - role: members with one of the selected roles
 * Future: specific users. For v1 we ship all + role.
 */
export type PushRecipientScope =
  | { kind: 'all' }
  | { kind: 'role'; role: PushRole };

/**
 * Max rows the panel shows by default. Larger lists
 * force pagination, which we don't want for the
 * 30-second-poll flow. The "see all" link goes to
 * a dedicated page (v2) or just shows more on
 * scroll. For v1 we cap at 50 in the panel and
 * the user can dismiss old ones.
 */
export const PANEL_LIMIT = 50;
export const PANEL_UNREAD_LIMIT = 20;
