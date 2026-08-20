// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * updateCheckInEventAction / closeCheckInEventAction —
 * server-action unit tests.
 *
 * We mock Prisma + Clerk auth + the role gate and
 * assert the right mutation runs with the right
 * fields under each scenario.
 */

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

const { requireRoleMock, getWorkspaceMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
}));
vi.mock('@/lib/auth/require-role', () => ({
  requireRole: (...a: unknown[]) => requireRoleMock(...a),
}));
vi.mock('@/lib/workspace/get-workspace', () => ({
  getWorkspace: (...a: unknown[]) => getWorkspaceMock(...a),
}));

const {
  findFirstMock,
  updateMock,
  updateManyMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
  updateManyMock: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    checkInEvent: {
      findFirst: (...a: unknown[]) => findFirstMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      updateMany: (...a: unknown[]) => updateManyMock(...a),
    },
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { updateCheckInEventAction, closeCheckInEventAction } from '../actions';

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'u_admin' });
  getWorkspaceMock.mockResolvedValue({ id: 'ws_1', slug: 'udgok' });
  requireRoleMock.mockResolvedValue(undefined);
  findFirstMock.mockResolvedValue({ id: 'evt_1', checkedInAt: new Date(), checkedOutAt: new Date() });
  updateMock.mockResolvedValue({ id: 'evt_1' });
  updateManyMock.mockResolvedValue({ count: 1 });
});

describe('updateCheckInEventAction', () => {
  it('rejects unauthenticated callers', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
      editedHours: '7',
      editNote: 'forgot to clock out',
    }));
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('requires an edit note when overriding hours', async () => {
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
      editedHours: '7',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/note/i);
    }
  });

  it('rejects hours > 24', async () => {
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
      editedHours: '25',
      editNote: 'nope',
    }));
    expect(res.ok).toBe(false);
  });

  it('rejects negative hours', async () => {
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
      editedHours: '-1',
      editNote: 'nope',
    }));
    expect(res.ok).toBe(false);
  });

  it('rejects checkedOutAt before checkedInAt', async () => {
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
      checkedInAt: '2026-08-19T15:00:00Z',
      checkedOutAt: '2026-08-19T07:00:00Z',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/check-out/i);
    }
  });

  it('clears the override when editedHours is empty string', async () => {
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
      editedHours: '',
    }));
    expect(res.ok).toBe(true);
    const data = updateMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.editedHours).toBeNull();
    expect(data.editedById).toBeNull();
    expect(data.editedAt).toBeNull();
    expect(data.editNote).toBeNull();
  });

  it('writes the override + audit fields on success', async () => {
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
      editedHours: '7.5',
      editNote: 'forgot lunch clock-out',
    }));
    expect(res.ok).toBe(true);
    const data = updateMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.editedHours).toBe(7.5);
    expect(data.editedById).toBe('u_admin');
    expect(data.editedAt).toBeInstanceOf(Date);
    expect(data.editNote).toBe('forgot lunch clock-out');
  });

  it('rejects when the event is not in this workspace', async () => {
    findFirstMock.mockResolvedValue(null);
    const res = await updateCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_other',
      editedHours: '7',
      editNote: 'x',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/not found/i);
    }
  });
});

describe('closeCheckInEventAction', () => {
  it('sets checkedOutAt to now', async () => {
    const res = await closeCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_1',
    }));
    expect(res.ok).toBe(true);
    const data = updateManyMock.mock.calls[0][0].data as { checkedOutAt: Date };
    expect(data.checkedOutAt).toBeInstanceOf(Date);
    const where = updateManyMock.mock.calls[0][0].where as { id: string; workspaceId: string };
    expect(where.id).toBe('evt_1');
    expect(where.workspaceId).toBe('ws_1');
  });

  it('returns error when event not in workspace', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    const res = await closeCheckInEventAction('udgok', undefined, fd({
      eventId: 'evt_other',
    }));
    expect(res.ok).toBe(false);
  });
});
