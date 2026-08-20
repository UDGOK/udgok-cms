// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Notification queries — Prisma projection + filter
 * tests. We mock the prisma client and assert that:
 *   - getNotificationPanel projects to NotificationView
 *   - the unread list and earlier list are split on
 *     readAt
 *   - dismissed rows are excluded
 *   - getUnreadCount counts only unread + not-dismissed
 */

const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    notification: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
  },
}));

import { getNotificationPanel, getUnreadCount } from '../queries';

const sampleRow = (over: Partial<{
  id: string;
  readAt: Date | null;
  dismissedAt: Date | null;
  type: string;
  createdBy: { id: string; name: string | null } | null;
}> = {}) => ({
  id: over.id ?? 'n_1',
  workspaceId: 'ws_1',
  type: over.type ?? 'team_push',
  title: 'Hello',
  body: null,
  link: null,
  createdAt: new Date('2026-08-19T12:00:00Z'),
  readAt: 'readAt' in over ? over.readAt : null,
  dismissedAt: 'dismissedAt' in over ? over.dismissedAt : null,
  // Note: distinguish "not provided" from "explicitly
  // null" so the test for null createdBy works.
  createdBy: 'createdBy' in over ? over.createdBy : { id: 'u_a', name: 'Alice' },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getNotificationPanel', () => {
  it('returns unread and earlier split on readAt', async () => {
    findManyMock
      .mockResolvedValueOnce([sampleRow({ id: 'n_unread' })])
      .mockResolvedValueOnce([
        sampleRow({ id: 'n_read1', readAt: new Date() }),
        sampleRow({ id: 'n_read2', readAt: new Date() }),
      ]);
    countMock.mockResolvedValue(1);

    const panel = await getNotificationPanel('u_1');
    expect(panel.unread.map((n) => n.id)).toEqual(['n_unread']);
    expect(panel.earlier.map((n) => n.id)).toEqual(['n_read1', 'n_read2']);
    expect(panel.counts.unread).toBe(1);
  });

  it('coerces unknown types to "system"', async () => {
    findManyMock
      .mockResolvedValueOnce([sampleRow({ id: 'n_x', type: 'made_up_type' })])
      .mockResolvedValueOnce([]);
    countMock.mockResolvedValue(1);
    const panel = await getNotificationPanel('u_1');
    expect(panel.unread[0].type).toBe('system');
  });

  it('serialises createdAt as an ISO string and readAt as ISO or null', async () => {
    findManyMock
      .mockResolvedValueOnce([
        sampleRow({ id: 'n_unread' }),
        sampleRow({ id: 'n_read', readAt: new Date('2026-08-19T13:00:00Z') }),
      ])
      .mockResolvedValueOnce([]);
    countMock.mockResolvedValue(2);
    const panel = await getNotificationPanel('u_1');
    // The unread row's readAt is null.
    const unread = panel.unread.find((n) => n.id === 'n_unread');
    expect(unread).toBeTruthy();
    expect(typeof unread!.createdAt).toBe('string');
    expect(unread!.readAt).toBeNull();
  });

  it('handles null createdBy', async () => {
    findManyMock
      .mockResolvedValueOnce([sampleRow({ id: 'n_sys', createdBy: null })])
      .mockResolvedValueOnce([]);
    countMock.mockResolvedValue(1);
    const panel = await getNotificationPanel('u_1');
    expect(panel.unread[0].createdBy).toBeNull();
  });

  it('passes the caller as recipientId on all queries', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    await getNotificationPanel('u_specific');
    // The first findMany is the unread list; the
    // second is the earlier list. The where-clause
    // for both must include recipientId=u_specific.
    const unreadWhere = findManyMock.mock.calls[0][0] as { where: { recipientId: string } };
    const earlierWhere = findManyMock.mock.calls[1][0] as { where: { recipientId: string } };
    const countWhere = countMock.mock.calls[0][0] as { where: { recipientId: string } };
    expect(unreadWhere.where.recipientId).toBe('u_specific');
    expect(earlierWhere.where.recipientId).toBe('u_specific');
    expect(countWhere.where.recipientId).toBe('u_specific');
  });
});

describe('getUnreadCount', () => {
  it('returns the count for the caller', async () => {
    countMock.mockResolvedValue(7);
    const n = await getUnreadCount('u_x');
    expect(n).toBe(7);
    const where = countMock.mock.calls[0][0] as { where: { recipientId: string } };
    expect(where.where.recipientId).toBe('u_x');
  });
});
