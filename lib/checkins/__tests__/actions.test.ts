import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the check-in / check-out action.
 *
 * Covers:
 *   - happy path (check in, then check out)
 *   - double check-in is a no-op (the action toggles)
 *   - retired code is rejected
 *   - anonymous sub path resolves to a sub in the
 *     project workspace
 *   - authed user path uses the Clerk session
 *   - sub cross-workspace attempt is rejected
 */

// Clerk
const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

// Prisma
const siteCheckInCodeFindUnique = vi.fn();
const subcontractorFindFirst = vi.fn();
const userFindUnique = vi.fn();
const checkInEventFindFirst = vi.fn();
const checkInEventCreate = vi.fn();
const checkInEventUpdate = vi.fn();
const activityLogCreate = vi.fn();
const scanEventCreate = vi.fn();
const projectFindFirst = vi.fn();
const siteCheckInCodeCreate = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    siteCheckInCode: {
      findUnique: (...a: unknown[]) => siteCheckInCodeFindUnique(...a),
      create: (...a: unknown[]) => siteCheckInCodeCreate(...a),
    },
    subcontractor: {
      findFirst: (...a: unknown[]) => subcontractorFindFirst(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
    },
    checkInEvent: {
      findFirst: (...a: unknown[]) => checkInEventFindFirst(...a),
      create: (...a: unknown[]) => checkInEventCreate(...a),
      update: (...a: unknown[]) => checkInEventUpdate(...a),
    },
    activityLog: {
      create: (...a: unknown[]) => activityLogCreate(...a),
    },
    scanEvent: {
      create: (...a: unknown[]) => scanEventCreate(...a),
    },
    project: {
      findFirst: (...a: unknown[]) => projectFindFirst(...a),
    },
  },
}));

vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({
    userId: 'admin_1', workspaceId: 'ws_1', role: 'OWNER', email: 'a@x.com', name: 'Admin',
  }),
}));

vi.mock('@/lib/workspace/get-workspace', () => ({
  getWorkspace: vi.fn().mockResolvedValue({ id: 'ws_1', slug: 'my-ws', name: 'Test' }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  generateCheckInCodeAction,
  deactivateCheckInCodeAction,
  toggleCheckInAction,
} from '../actions';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: signed in as an admin
  authMock.mockResolvedValue({ userId: 'admin_1' });
  projectFindFirst.mockResolvedValue({ id: 'proj_1' });
  siteCheckInCodeCreate.mockResolvedValue({ id: 'code_1', token: 'tok_1' });
  activityLogCreate.mockResolvedValue({});
  userFindUnique.mockResolvedValue({ name: 'Admin', email: 'a@x.com' });
  checkInEventCreate.mockResolvedValue({ id: 'evt_1', checkedInAt: new Date('2026-08-20T12:00:00Z') });
  checkInEventUpdate.mockResolvedValue({});
  scanEventCreate.mockResolvedValue({});
});

function makeFormData(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.append(k, v);
  return fd;
}

describe('generateCheckInCodeAction', () => {
  it('creates a code with a fresh token and the given label', async () => {
    const res = await generateCheckInCodeAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      label: 'main gate',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.id).toBe('code_1');
    expect(res.token).toBe('tok_1');
    expect(siteCheckInCodeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          projectId: 'proj_1',
          label: 'main gate',
          createdById: 'admin_1',
          isActive: true,
        }),
      }),
    );
  });

  it('rejects a missing projectId', async () => {
    const res = await generateCheckInCodeAction('my-ws', undefined, makeFormData({
      label: 'no project',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors?.projectId).toBeTruthy();
  });

  it('rejects an empty label', async () => {
    const res = await generateCheckInCodeAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      label: '',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors?.label).toBeTruthy();
  });

  it('rejects when the project does not belong to this workspace', async () => {
    projectFindFirst.mockResolvedValue(null);
    const res = await generateCheckInCodeAction('my-ws', undefined, makeFormData({
      projectId: 'proj_evil',
      label: 'evil',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/not found/i);
  });

  it('rejects when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await generateCheckInCodeAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      label: 'main',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/sign/i);
  });

  it('retries on a unique-token collision (P2002)', async () => {
    const p2002 = new Error('P2002') as Error & { code: string };
    p2002.code = 'P2002';
    siteCheckInCodeCreate
      .mockRejectedValueOnce(p2002)
      .mockResolvedValueOnce({ id: 'code_2', token: 'tok_2' });

    const res = await generateCheckInCodeAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      label: 'retry',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.id).toBe('code_2');
    expect(siteCheckInCodeCreate).toHaveBeenCalledTimes(2);
  });
});

describe('deactivateCheckInCodeAction', () => {
  it('rejects when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await deactivateCheckInCodeAction('my-ws', 'code_x', false);
    expect(res.ok).toBe(false);
  });
});

describe('toggleCheckInAction — happy path (signed in)', () => {
  it('opens a new check-in when none is open', async () => {
    authMock.mockResolvedValue({ userId: 'user_emp' });
    siteCheckInCodeFindUnique.mockResolvedValue({
      id: 'code_1',
      isActive: true,
      token: 'tok_abcdefgh',
      project: { id: 'proj_1', name: 'Smith Residence', workspaceId: 'ws_1' },
    });
    checkInEventFindFirst.mockResolvedValue(null); // no open one
    userFindUnique.mockResolvedValue({ name: 'Bob Builder', email: 'bob@x.com' });

    const res = await toggleCheckInAction(undefined, makeFormData({
      token: 'tok_abcdefgh',
      lat: '36.1234',
      lng: '-95.1234',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.action).toBe('checked_in');
    expect(res.projectName).toBe('Smith Residence');
    expect(res.whoName).toBe('Bob Builder');
    expect(checkInEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          siteCheckInCodeId: 'code_1',
          projectId: 'proj_1',
          userId: 'user_emp',
          checkInLat: 36.1234,
          checkInLng: -95.1234,
        }),
      }),
    );
    // The audit log ScanEvent should also be written
    expect(scanEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          userId: 'user_emp',
          matched: 'checkin',
          matchedId: 'code_1',
        }),
      }),
    );
  });

  it('closes an existing open check-in (toggle)', async () => {
    authMock.mockResolvedValue({ userId: 'user_emp' });
    siteCheckInCodeFindUnique.mockResolvedValue({
      id: 'code_1',
      isActive: true,
      token: 'tok_abcdefgh',
      project: { id: 'proj_1', name: 'Smith', workspaceId: 'ws_1' },
    });
    checkInEventFindFirst.mockResolvedValue({
      id: 'evt_open',
      userId: 'user_emp',
      subcontractorId: null,
      projectId: 'proj_1',
      checkedInAt: new Date('2026-08-20T08:00:00Z'),
    });
    userFindUnique.mockResolvedValue({ name: 'Bob', email: 'bob@x.com' });

    const res = await toggleCheckInAction(undefined, makeFormData({ token: 'tok_abcdefgh' }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.action).toBe('checked_out');
    expect(checkInEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt_open' },
        data: expect.objectContaining({
          checkedOutAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe('toggleCheckInAction — anonymous sub path', () => {
  it('opens a check-in for the picked sub when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    siteCheckInCodeFindUnique.mockResolvedValue({
      id: 'code_1',
      isActive: true,
      token: 'tok_abcdefgh',
      project: { id: 'proj_1', name: 'Smith', workspaceId: 'ws_1' },
    });
    subcontractorFindFirst.mockResolvedValue({ id: 'sub_1', name: 'Acme Concrete' });
    checkInEventFindFirst.mockResolvedValue(null);

    const res = await toggleCheckInAction(undefined, makeFormData({
      token: 'tok_abcdefgh',
      subcontractorId: 'sub_1',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.action).toBe('checked_in');
    expect(res.whoName).toBe('Acme Concrete');
    expect(checkInEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subcontractorId: 'sub_1',
          projectId: 'proj_1',
        }),
      }),
    );
    // Audit log ScanEvent should NOT be written for an
    // anonymous sub path (no userId to attribute the
    // scan to).
    expect(scanEventCreate).not.toHaveBeenCalled();
  });

  it('rejects a sub from a different workspace', async () => {
    authMock.mockResolvedValue({ userId: null });
    siteCheckInCodeFindUnique.mockResolvedValue({
      id: 'code_1',
      isActive: true,
      token: 'tok_abcdefgh',
      project: { id: 'proj_1', name: 'Smith', workspaceId: 'ws_1' },
    });
    // Cross-workspace lookup returns null
    subcontractorFindFirst.mockResolvedValue(null);

    const res = await toggleCheckInAction(undefined, makeFormData({
      token: 'tok_abcdefgh',
      subcontractorId: 'sub_evil',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/not found/i);
  });

  it('rejects an anonymous scan with no subcontractor picked', async () => {
    authMock.mockResolvedValue({ userId: null });
    siteCheckInCodeFindUnique.mockResolvedValue({
      id: 'code_1',
      isActive: true,
      token: 'tok_abcdefgh',
      project: { id: 'proj_1', name: 'Smith', workspaceId: 'ws_1' },
    });

    const res = await toggleCheckInAction(undefined, makeFormData({
      token: 'tok_abcdefgh',
      // subcontractorId missing
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/subcontractor/i);
  });
});

describe('toggleCheckInAction — code state guards', () => {
  it('rejects when the token is unknown', async () => {
    siteCheckInCodeFindUnique.mockResolvedValue(null);
    authMock.mockResolvedValue({ userId: 'user_emp' });

    const res = await toggleCheckInAction(undefined, makeFormData({ token: 'nope_nope_nope' }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/not found/i);
  });

  it('rejects when the code is retired (isActive=false)', async () => {
    siteCheckInCodeFindUnique.mockResolvedValue({
      id: 'code_1',
      isActive: false,
      token: 'tok_abcdefgh',
      project: { id: 'proj_1', name: 'Smith', workspaceId: 'ws_1' },
    });
    authMock.mockResolvedValue({ userId: 'user_emp' });

    const res = await toggleCheckInAction(undefined, makeFormData({ token: 'tok_abcdefgh' }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/retired/i);
  });
});

describe('toggleCheckInAction — can\'t double check-in', () => {
  it('does not open a second check-in if one is already open for the same person', async () => {
    // This is a re-statement of the toggle behavior:
    // if findFirst returns the existing open event, we
    // call update (check out) instead of create. The
    // happy-path "closes an existing" test above already
    // covers the transition — this test guards the
    // invariant that create is never called when an
    // open event exists.
    authMock.mockResolvedValue({ userId: 'user_emp' });
    siteCheckInCodeFindUnique.mockResolvedValue({
      id: 'code_1',
      isActive: true,
      token: 'tok_abcdefgh',
      project: { id: 'proj_1', name: 'Smith', workspaceId: 'ws_1' },
    });
    checkInEventFindFirst.mockResolvedValue({
      id: 'evt_open',
      userId: 'user_emp',
      subcontractorId: null,
      projectId: 'proj_1',
    });
    userFindUnique.mockResolvedValue({ name: 'Bob', email: 'bob@x.com' });

    const res = await toggleCheckInAction(undefined, makeFormData({ token: 'tok_abcdefgh' }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.action).toBe('checked_out');
    expect(checkInEventCreate).not.toHaveBeenCalled();
  });
});
