import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

const txMock = {
  projectDivision: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
    createMany: vi.fn(),
  },
};
const bimTakeoffFindFirst = vi.fn();
const projectFindFirst = vi.fn();
const $transaction = vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: { findFirst: (...args: unknown[]) => projectFindFirst(...args) },
    bimTakeoff: { findFirst: (...args: unknown[]) => bimTakeoffFindFirst(...args) },
    $transaction: (...args: unknown[]) => $transaction(...args),
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { pushTakeoffToSovAction } from '../actions';

beforeEach(() => {
  authMock.mockReset();
  bimTakeoffFindFirst.mockReset();
  projectFindFirst.mockReset();
  $transaction.mockClear();
  txMock.projectDivision.findMany.mockReset();
  txMock.projectDivision.aggregate.mockReset();
  txMock.projectDivision.createMany.mockReset();
  $transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));
});

describe('pushTakeoffToSovAction', () => {
  it('creates only lines whose CSI code is not already on the SOV', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1', workspaceId: 'ws_1' });
    bimTakeoffFindFirst.mockResolvedValue({ id: 'tk_1' });
    // Existing CSI codes on the SOV: 03-3000 (concrete) and 22-1000 (plumbing)
    txMock.projectDivision.findMany.mockResolvedValue([
      { code: '03-3000' },
      { code: '22-1000' },
    ]);
    txMock.projectDivision.aggregate.mockResolvedValue({ _max: { sortOrder: 5 } });

    const result = await pushTakeoffToSovAction(
      'my-ws',
      'proj_1',
      'tk_1',
      [
        { csiCode: '03-3000', trade: 'Concrete slabs',  budget: 5000 },  // skip
        { csiCode: '05-1200', trade: 'Steel beams',    budget: 12000 }, // create
        { csiCode: '09-2900', trade: 'Drywall',        budget: 8000 },  // create
        { csiCode: '22-1000', trade: 'Plumbing pipe',  budget: 2000 },  // skip
      ],
    );

    expect(result).toEqual({ ok: true, created: 2, skipped: 2 });
    expect(txMock.projectDivision.createMany).toHaveBeenCalledTimes(1);
    const created = txMock.projectDivision.createMany.mock.calls[0][0] as {
      data: Array<{ code: string; trade: string; budget: number; sortOrder: number }>;
    };
    expect(created.data).toHaveLength(2);
    expect(created.data.map((d) => d.code).sort()).toEqual(['05-1200', '09-2900']);
    // sortOrder is contiguous from max+1
    expect(created.data.map((d) => d.sortOrder).sort((a, b) => a - b)).toEqual([6, 7]);
  });

  it('returns ok=false, error=Already exists when every CSI code is a duplicate', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1' });
    bimTakeoffFindFirst.mockResolvedValue({ id: 'tk_1' });
    txMock.projectDivision.findMany.mockResolvedValue([{ code: '03-3000' }]);
    txMock.projectDivision.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });

    const result = await pushTakeoffToSovAction(
      'my-ws', 'proj_1', 'tk_1',
      [{ csiCode: '03-3000', trade: 'Concrete', budget: 1000 }],
    );
    expect(result?.ok).toBeFalsy();
    expect(result?.error).toMatch(/already/i);
    // The contract is: created=0, skipped=N. We expect NO createMany call.
    expect(txMock.projectDivision.createMany).not.toHaveBeenCalled();
  });

  it('rejects when the takeoff is not DONE', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1' });
    bimTakeoffFindFirst.mockResolvedValue(null); // status: anything but DONE

    const result = await pushTakeoffToSovAction(
      'my-ws', 'proj_1', 'tk_1',
      [{ csiCode: '03-3000', trade: 'Concrete', budget: 1000 }],
    );
    expect(result?.ok).toBeFalsy();
    expect(result?.error).toMatch(/not.*complete|not.*found/i);
  });

  it('rejects when budget is negative (defends UI bugs that send NaN/negatives)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1' });
    bimTakeoffFindFirst.mockResolvedValue({ id: 'tk_1' });

    const result = await pushTakeoffToSovAction(
      'my-ws', 'proj_1', 'tk_1',
      [{ csiCode: '03-3000', trade: 'Concrete', budget: -10 }],
    );
    expect(result?.ok).toBeFalsy();
    expect(result?.error).toMatch(/invalid|line data/i);
  });
});
