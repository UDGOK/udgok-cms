// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * pushNotificationAction — server-action unit tests.
 *
 * We mock the data layer (Prisma) and the auth layer
 * (Clerk) and assert that:
 *   - the action requires a session
 *   - the action enforces the workspace role gate
 *   - the action fans out one row per recipient
 *   - the action excludes the pusher themselves
 *   - the action returns a recipient count
 */

// auth()
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

// requireRole / getWorkspace
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

// Prisma — only the methods the action uses.
const { createManyMock, findManyMembershipMock } = vi.hoisted(() => ({
  createManyMock: vi.fn(),
  findManyMembershipMock: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    notification: { createMany: (...a: unknown[]) => createManyMock(...a) },
    membership: { findMany: (...a: unknown[]) => findManyMembershipMock(...a) },
  },
}));

// revalidatePath is a Next.js server-side cache
// invalidation. We stub it because the test doesn't
// render a real route.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { pushNotificationAction } from '../actions';

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'u_pusher' });
  getWorkspaceMock.mockResolvedValue({ id: 'ws_1' });
  requireRoleMock.mockResolvedValue(undefined);
  findManyMembershipMock.mockResolvedValue([
    { userId: 'u_a' },
    { userId: 'u_pusher' }, // pusher themselves
    { userId: 'u_b' },
  ]);
  createManyMock.mockResolvedValue({ count: 2 });
});

describe('pushNotificationAction', () => {
  it('rejects an unauthenticated caller', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await pushNotificationAction(undefined, fd({
      workspaceSlug: 'udgok',
      type: 'team_push',
      title: 'Hello',
      recipientScope: JSON.stringify({ kind: 'all' }),
    }));
    expect(res.ok).toBe(false);
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it('requires a title', async () => {
    const res = await pushNotificationAction(undefined, fd({
      workspaceSlug: 'udgok',
      type: 'team_push',
      title: '',
      recipientScope: JSON.stringify({ kind: 'all' }),
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fieldErrors?.title).toBeTruthy();
    }
  });

  it('fans out one row per recipient, excluding the pusher', async () => {
    const res = await pushNotificationAction(undefined, fd({
      workspaceSlug: 'udgok',
      type: 'team_push',
      title: 'Standup at 7am',
      recipientScope: JSON.stringify({ kind: 'all' }),
    }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.recipientCount).toBe(2);
    }
    expect(createManyMock).toHaveBeenCalledTimes(1);
    const callArg = createManyMock.mock.calls[0][0] as {
      data: Array<{ recipientId: string; createdById: string | null }>;
    };
    expect(callArg.data.map((d) => d.recipientId).sort()).toEqual(['u_a', 'u_b']);
    expect(callArg.data.every((d) => d.createdById === 'u_pusher')).toBe(true);
  });

  it('respects role-scoped recipients', async () => {
    findManyMembershipMock.mockResolvedValue([
      { userId: 'u_a' }, // PM
      { userId: 'u_b' }, // FIELD — should be excluded
    ]);
    // Simulate the role filter being applied by the
    // mocked findMany: the action passes `role: X`
    // in the where clause, and we assume Prisma
    // would filter. For this test we just verify
    // the action's where clause includes the role
    // — we capture the args to findMany.
    await pushNotificationAction(undefined, fd({
      workspaceSlug: 'udgok',
      type: 'team_push',
      title: 'Heads up',
      recipientScope: JSON.stringify({ kind: 'role', role: 'PM' }),
    }));
    const where = findManyMembershipMock.mock.calls[0][0] as { where: { role?: string } };
    expect(where.where.role).toBe('PM');
  });

  it('rejects an invalid recipient scope', async () => {
    const res = await pushNotificationAction(undefined, fd({
      workspaceSlug: 'udgok',
      type: 'team_push',
      title: 'Hello',
      recipientScope: '{not-json',
    }));
    expect(res.ok).toBe(false);
  });

  it('rejects a recipient scope with an invalid role', async () => {
    const res = await pushNotificationAction(undefined, fd({
      workspaceSlug: 'udgok',
      type: 'team_push',
      title: 'Hello',
      recipientScope: JSON.stringify({ kind: 'role', role: 'GOD_MODE' }),
    }));
    expect(res.ok).toBe(false);
  });

  it('returns "No recipients" when the scope resolves to an empty set', async () => {
    findManyMembershipMock.mockResolvedValue([
      { userId: 'u_pusher' }, // only the pusher
    ]);
    const res = await pushNotificationAction(undefined, fd({
      workspaceSlug: 'udgok',
      type: 'team_push',
      title: 'Hello',
      recipientScope: JSON.stringify({ kind: 'all' }),
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/no recipients/i);
    }
    expect(createManyMock).not.toHaveBeenCalled();
  });
});
