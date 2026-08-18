import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Clerk
const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

// Mock Prisma
const workspaceFindUnique = vi.fn();
const projectFindFirst = vi.fn();
const payAppCreate = vi.fn();
const payAppFindFirst = vi.fn();
const payAppDivisionFindMany = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspace: { findUnique: (...args: unknown[]) => workspaceFindUnique(...args) },
    project: { findFirst: (...args: unknown[]) => projectFindFirst(...args) },
    payApp: {
      create: (...args: unknown[]) => payAppCreate(...args),
      findFirst: (...args: unknown[]) => payAppFindFirst(...args),
    },
    payAppDivision: { findMany: (...args: unknown[]) => payAppDivisionFindMany(...args) },
    user: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({
    userId: 'user_1',
    workspaceId: 'ws_1',
    role: 'OWNER',
    email: 'me@x.com',
    name: 'Me',
  }),
}));

vi.mock('@/lib/workspace/get-workspace', () => ({
  getWorkspace: vi.fn().mockImplementation(async (slug: string) => {
    if (slug === 'my-ws') return { id: 'ws_1', slug: 'my-ws', name: 'Test' };
    return null;
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('resend', () => ({ Resend: vi.fn() }));

import { generatePayAppAction } from '../actions';

beforeEach(() => {
  authMock.mockReset();
  currentUserMock.mockReset();
  workspaceFindUnique.mockReset();
  projectFindFirst.mockReset();
  payAppCreate.mockReset();
  payAppFindFirst.mockReset();
  payAppDivisionFindMany.mockReset();
  // Default: no prior pay apps / divisions found
  payAppFindFirst.mockResolvedValue(null);
  payAppDivisionFindMany.mockResolvedValue([]);
});

function mockFormData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

describe('generatePayAppAction', () => {
  it('creates the first pay app correctly (no previous draws)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1', slug: 'my-ws' });
    projectFindFirst.mockResolvedValue({
      id: 'proj_1',
      divisions: [
        { id: 'd1', code: '01', trade: 'Site prep', budget: 1000, sortOrder: 0 },
        { id: 'd2', code: '02', trade: 'Framing', budget: 4000, sortOrder: 1 },
      ],
      payApps: [], // no prior pay apps
    });
    // No prior pay app lines
    payAppDivisionFindMany.mockResolvedValue([]);
    payAppFindFirst.mockResolvedValue(null);
    payAppCreate.mockResolvedValue({ id: 'pa_1', shareToken: 'tok_1' });

    const result = await generatePayAppAction('my-ws', 'proj_1', undefined, mockFormData({
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
      thisDraw_d1: '500',
      thisDraw_d2: '1000',
    }));

    expect(result).toEqual({ id: 'pa_1' });
    expect(payAppCreate).toHaveBeenCalledTimes(1);
    const call = payAppCreate.mock.calls[0][0];
    expect(call.data).toMatchObject({
      projectId: 'proj_1',
      drawNumber: 1,
      status: 'DRAFT',
      totalContract: 5000, // 1000 + 4000
      totalPrevious: 0,    // no prior
      totalThisDraw: 1500, // 500 + 1000
      totalBalance: 3500,  // 5000 - 0 - 1500
      createdById: 'user_1',
    });
    expect(call.data.divisions.create).toEqual([
      {
        projectDivisionId: 'd1',
        previousAmount: 0,
        thisDrawAmount: 500,
        balanceAfter: 500, // 1000 - 0 - 500
        sortOrder: 0,
      },
      {
        projectDivisionId: 'd2',
        previousAmount: 0,
        thisDrawAmount: 1000,
        balanceAfter: 3000, // 4000 - 0 - 1000
        sortOrder: 1,
      },
    ]);
    expect(call.data.shareToken).toBeTruthy();
  });

  it('cumulative math: draw 2 uses sum of prior thisDrawAmount as previous', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1', slug: 'my-ws' });
    projectFindFirst.mockResolvedValue({
      id: 'proj_1',
      divisions: [
        { id: 'd1', code: '01', trade: 'Site prep', budget: 1000, sortOrder: 0 },
      ],
      payApps: [{ drawNumber: 1 }],
    });
    // Prior pay app division: billed 500 of 1000
    payAppDivisionFindMany.mockResolvedValue([
      { projectDivisionId: 'd1', thisDrawAmount: 500 },
    ]);
    payAppFindFirst.mockResolvedValue({ drawNumber: 1 });
    payAppCreate.mockResolvedValue({ id: 'pa_2', shareToken: 'tok_2' });

    await generatePayAppAction('my-ws', 'proj_1', undefined, mockFormData({
      periodStart: '2024-04-01',
      periodEnd: '2024-04-30',
      thisDraw_d1: '300',
    }));

    const call = payAppCreate.mock.calls[0][0];
    expect(call.data.drawNumber).toBe(2);
    expect(call.data.totalPrevious).toBe(500);  // from sum of prior thisDrawAmount
    expect(call.data.totalThisDraw).toBe(300);
    expect(call.data.totalBalance).toBe(200);   // 1000 - 500 - 300
    expect(call.data.divisions.create[0]).toEqual({
      projectDivisionId: 'd1',
      previousAmount: 500, // from cumulative prior thisDrawAmount
      thisDrawAmount: 300,
      balanceAfter: 200,  // 1000 - 500 - 300
      sortOrder: 0,
    });
  });

  it('rejects when the project has no divisions', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1', divisions: [], payApps: [] });

    const result = await generatePayAppAction('my-ws', 'proj_1', undefined, mockFormData({
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
    }));

    expect(result?.error).toMatch(/at least one division/i);
    expect(payAppCreate).not.toHaveBeenCalled();
  });

  it('rejects when the project is not in this workspace', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
    projectFindFirst.mockResolvedValue(null);

    const result = await generatePayAppAction('my-ws', 'proj_xx', undefined, mockFormData({
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
    }));

    expect(result).toEqual({ error: 'Project not found' });
  });

  it('clamps balanceAfter at 0 (no negative balances)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
    projectFindFirst.mockResolvedValue({
      id: 'proj_1',
      divisions: [{ id: 'd1', code: '01', trade: 'Over-bill', budget: 100, sortOrder: 0 }],
      payApps: [],
    });
    payAppDivisionFindMany.mockResolvedValue([]);
    payAppFindFirst.mockResolvedValue(null);
    payAppCreate.mockResolvedValue({ id: 'pa_1', shareToken: 't' });

    // User tries to bill 200 against a 100-budget line
    await generatePayAppAction('my-ws', 'proj_1', undefined, mockFormData({
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
      thisDraw_d1: '200',
    }));

    const call = payAppCreate.mock.calls[0][0];
    expect(call.data.divisions.create[0].balanceAfter).toBe(0); // clamped, not -100
  });
});
