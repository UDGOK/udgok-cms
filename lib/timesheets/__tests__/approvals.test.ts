// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Timesheet approval state machine — server-action
 * tests. We mock Prisma + Clerk + role gate and
 * assert the right state transition + the right
 * audit fields under each scenario.
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
  upsertMock,
  updateMock,
  findUniqueMock,
  findManyMock,
  checkInFindManyMock,
  membershipFindUniqueMock,
} = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  updateMock: vi.fn(),
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
  checkInFindManyMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    weeklyTimesheet: {
      upsert: (...a: unknown[]) => upsertMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
    },
    membership: { findUnique: (...a: unknown[]) => membershipFindUniqueMock(...a) },
    checkInEvent: { findMany: (...a: unknown[]) => checkInFindManyMock(...a) },
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  submitTimesheetAction,
  approveTimesheetAction,
  rejectTimesheetAction,
  unlockTimesheetAction,
  findLockingTimesheet,
} from '../approvals';

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
  upsertMock.mockResolvedValue({ id: 'wt_1', status: 'DRAFT' });
  updateMock.mockResolvedValue({ id: 'wt_1' });
  // Default: not approver. Tests that need it override.
  membershipFindUniqueMock.mockResolvedValue({ role: 'PM' });
  checkInFindManyMock.mockResolvedValue([]);
});

describe('submitTimesheetAction', () => {
  it('moves DRAFT to SUBMITTED for own employee row', async () => {
    authMock.mockResolvedValue({ userId: 'u_emp' });
    membershipFindUniqueMock.mockResolvedValue({ role: 'FIELD' });
    const res = await submitTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(true);
    const data = updateMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe('SUBMITTED');
    expect(data.submittedById).toBe('u_emp');
    expect(data.submittedAt).toBeInstanceOf(Date);
    // Clears any prior reject context.
    expect(data.rejectedById).toBeNull();
  });

  it('refuses to submit another employee\u2019s row without admin role', async () => {
    authMock.mockResolvedValue({ userId: 'u_emp' });
    membershipFindUniqueMock.mockResolvedValue({ role: 'FIELD' });
    const res = await submitTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_other',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/own timesheet/i);
    }
  });

  it('admin can submit on behalf of any employee', async () => {
    authMock.mockResolvedValue({ userId: 'u_admin' });
    membershipFindUniqueMock.mockResolvedValue({ role: 'ADMIN' });
    const res = await submitTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_other',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(true);
  });

  it('refuses to submit a sub row for non-approver', async () => {
    authMock.mockResolvedValue({ userId: 'u_emp' });
    membershipFindUniqueMock.mockResolvedValue({ role: 'FIELD' });
    const res = await submitTimesheetAction('udgok', undefined, fd({
      personKind: 'sub',
      personId: 'sub_1',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/admin/i);
    }
  });

  it('refuses to re-submit an already-APPROVED timesheet', async () => {
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'APPROVED' });
    const res = await submitTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/unlock/i);
    }
  });

  it('is a no-op when status is already SUBMITTED', async () => {
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'SUBMITTED' });
    const res = await submitTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('approveTimesheetAction', () => {
  it('moves SUBMITTED to APPROVED with snapshot total', async () => {
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'SUBMITTED', submittedById: 'u_emp' });
    authMock.mockResolvedValue({ userId: 'u_admin' });
    membershipFindUniqueMock.mockResolvedValue({ role: 'PM' });
    checkInFindManyMock.mockResolvedValue([
      { editedHours: 8, checkedInAt: new Date(), checkedOutAt: new Date() },
      { editedHours: null, checkedInAt: new Date(), checkedOutAt: new Date(Date.now() + 8 * 3_600_000) },
    ]);
    const res = await approveTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(true);
    const data = updateMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe('APPROVED');
    expect(data.approvedById).toBe('u_admin');
    expect(data.approvedAt).toBeInstanceOf(Date);
    // 8 (override) + 8 (computed) = 16
    expect(data.totalHoursAtApproval).toBe(16);
  });

  it('blocks self-approval (submitter == approver)', async () => {
    authMock.mockResolvedValue({ userId: 'u_admin' });
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'SUBMITTED', submittedById: 'u_admin' });
    membershipFindUniqueMock.mockResolvedValue({ role: 'PM' });
    const res = await approveTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/own submission/i);
    }
  });

  it('refuses to approve a DRAFT timesheet', async () => {
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'DRAFT' });
    const res = await approveTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/submitted/i);
    }
  });
});

describe('rejectTimesheetAction', () => {
  it('moves SUBMITTED to REJECTED with required note', async () => {
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'SUBMITTED' });
    const res = await rejectTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
      note: 'Missing lunch break on Tuesday',
    }));
    expect(res.ok).toBe(true);
    const data = updateMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe('REJECTED');
    expect(data.rejectNote).toBe('Missing lunch break on Tuesday');
    expect(data.rejectedAt).toBeInstanceOf(Date);
  });

  it('requires a note', async () => {
    const res = await rejectTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
      note: '',
    }));
    expect(res.ok).toBe(false);
  });
});

describe('unlockTimesheetAction', () => {
  it('moves APPROVED to DRAFT (preserves audit fields)', async () => {
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'APPROVED' });
    const res = await unlockTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(true);
    const data = updateMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe('DRAFT');
    // approvedById / approvedAt / totalHoursAtApproval
    // should NOT be cleared on unlock (preserved for
    // the "approved at X hours, now Y" history line).
    expect(data.approvedById).toBeUndefined();
  });

  it('refuses to unlock a DRAFT', async () => {
    upsertMock.mockResolvedValue({ id: 'wt_1', status: 'DRAFT' });
    const res = await unlockTimesheetAction('udgok', undefined, fd({
      personKind: 'employee',
      personId: 'u_emp',
      weekStart: '2026-08-17T00:00:00Z',
    }));
    expect(res.ok).toBe(false);
  });
});

describe('findLockingTimesheet', () => {
  it('returns the lock when an APPROVED timesheet covers the event', async () => {
    findUniqueMock.mockResolvedValue({ id: 'wt_1', weekStart: new Date(), status: 'APPROVED' });
    const lock = await findLockingTimesheet('ws_1', new Date('2026-08-19T07:00:00Z'), 'employee', 'u_emp');
    expect(lock).not.toBeNull();
    expect(lock?.status).toBe('APPROVED');
  });

  it('returns null when status is not APPROVED', async () => {
    findUniqueMock.mockResolvedValue({ id: 'wt_1', weekStart: new Date(), status: 'DRAFT' });
    const lock = await findLockingTimesheet('ws_1', new Date(), 'employee', 'u_emp');
    expect(lock).toBeNull();
  });

  it('returns null for unknown person kind', async () => {
    const lock = await findLockingTimesheet('ws_1', new Date(), 'unknown', null);
    expect(lock).toBeNull();
  });
});
