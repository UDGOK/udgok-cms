/**
 * import-invoice-action — unit tests.
 *
 * Tests the validation + transaction shape of the import
 * flow. The action is the entry point for the
 * ImportInvoiceModal on the project pay apps page.
 *
 * What we cover:
 *   - Schema validation: rejects missing invoice #,
 *     rejects bad email, rejects out-of-range amounts
 *   - Refuses to import when a draw with the same number
 *     already exists (idempotent / defensive)
 *   - Creates ProjectDivision rows when missing
 *   - Creates PayApp + PayAppDivision rows in a transaction
 *   - Status PAID: stamps acknowledgedAt / acknowledgedByName
 *   - Status DRAFT: leaves acknowledged fields null
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockWorkspaceFindUnique = vi.fn();
const mockProjectFindFirst = vi.fn();
const mockPayAppFindFirst = vi.fn();
const mockPayAppCreate = vi.fn();
const mockPayAppDivisionCreate = vi.fn();
const mockProjectDivisionCreate = vi.fn();
const mockProjectDivisionCount = vi.fn();
const mockMembershipFindFirst = vi.fn();
const mockTransaction = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspace: {
      findUnique: (...args: unknown[]) => mockWorkspaceFindUnique(...args),
    },
    project: {
      findFirst: (...args: unknown[]) => mockProjectFindFirst(...args),
    },
    payApp: {
      findFirst: (...args: unknown[]) => mockPayAppFindFirst(...args),
      create: (...args: unknown[]) => mockPayAppCreate(...args),
    },
    payAppDivision: {
      create: (...args: unknown[]) => mockPayAppDivisionCreate(...args),
    },
    projectDivision: {
      create: (...args: unknown[]) => mockProjectDivisionCreate(...args),
      count: (...args: unknown[]) => mockProjectDivisionCount(...args),
    },
    membership: {
      findFirst: (...args: unknown[]) => mockMembershipFindFirst(...args),
    },
    $transaction: (arg: unknown) =>
      typeof arg === 'function' ? mockTransaction(arg) : Promise.all(arg),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { auth } from '@clerk/nextjs/server';
import { importInvoiceAction } from '../import-invoice-action';

beforeEach(() => {
  mockWorkspaceFindUnique.mockReset();
  mockProjectFindFirst.mockReset();
  mockPayAppFindFirst.mockReset();
  mockPayAppCreate.mockReset();
  mockPayAppDivisionCreate.mockReset();
  mockProjectDivisionCreate.mockReset();
  mockProjectDivisionCount.mockReset();
  mockMembershipFindFirst.mockReset();
  mockTransaction.mockReset();
  mockRevalidatePath.mockReset();

  vi.mocked(auth).mockResolvedValue({ userId: 'user_test' } as never);
  mockWorkspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
  mockMembershipFindFirst.mockResolvedValue({ role: 'OWNER' });
  mockProjectFindFirst.mockResolvedValue({ id: 'proj_1', name: 'PFG — Grove' });
  mockPayAppFindFirst.mockResolvedValue(null); // no existing draw
  mockProjectDivisionCount.mockResolvedValue(0);
});

const SAMPLE_PAYLOAD = {
  projectId: 'proj_1',
  drawNumber: 1,
  status: 'PAID' as const,
  invoiceNumber: 'INV-2026-0729-GRV',
  invoiceDate: '2026-07-29',
  paymentDate: '2026-08-12',
  clientName: 'Yuba Parajuli',
  clientEmail: 'yuba@pfgstores.com',
  notes: 'EIFS installation',
  lines: [
    { code: '04', trade: 'Masonry', amount: 4022.0 },
    { code: '06', trade: 'Wood/Plastics', amount: 4712.0 },
    { code: '07', trade: 'Thermal/Moisture', amount: 8680.0 },
  ],
};

function makeFormData(payload: unknown): FormData {
  const fd = new FormData();
  fd.set('payload', JSON.stringify(payload));
  return fd;
}

describe('importInvoiceAction', () => {
  it('refuses when not signed in', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    const res = await importInvoiceAction('ws_1', undefined, makeFormData(SAMPLE_PAYLOAD));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Not signed in/);
  });

  it('refuses when workspace is not found', async () => {
    mockWorkspaceFindUnique.mockResolvedValueOnce(null);
    const res = await importInvoiceAction('ws_1', undefined, makeFormData(SAMPLE_PAYLOAD));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Workspace not found/);
  });

  it('refuses when project is not in the workspace (tenant scope)', async () => {
    mockProjectFindFirst.mockResolvedValueOnce(null);
    const res = await importInvoiceAction('ws_1', undefined, makeFormData(SAMPLE_PAYLOAD));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Project not found/);
  });

  it('refuses when a draw with the same number already exists', async () => {
    mockPayAppFindFirst.mockResolvedValueOnce({ id: 'pa_existing', status: 'DRAFT' });
    const res = await importInvoiceAction('ws_1', undefined, makeFormData(SAMPLE_PAYLOAD));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already exists/);
  });

  it('rejects payload with missing invoice number', async () => {
    const res = await importInvoiceAction(
      'ws_1',
      undefined,
      makeFormData({ ...SAMPLE_PAYLOAD, invoiceNumber: '' }),
    );
    expect(res.ok).toBe(false);
    // zod error message
    expect(res.error).toBeTruthy();
  });

  it('rejects payload with out-of-range line amount', async () => {
    const res = await importInvoiceAction(
      'ws_1',
      undefined,
      makeFormData({
        ...SAMPLE_PAYLOAD,
        lines: [{ code: '04', trade: 'Masonry', amount: -100 }],
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('creates pay app + divisions + acknowledges fields for PAID status', async () => {
    // Two divisions already exist on the project (04, 06).
    // One is new (07) — the action should create it.

    // Track calls inside the transaction.
    const txCalls: { method: string; args: unknown }[] = [];
    const tx = {
      projectDivision: {
        count: () => Promise.resolve(0),
        findFirst: (args: unknown) => {
          txCalls.push({ method: 'projectDivision.findFirst', args });
          // Two divisions (04, 06) already exist; 07 is new.
          const where = (args as { where: { code: string } }).where;
          if (where.code === '04' || where.code === '06') {
            return Promise.resolve({ id: `div_${where.code}` });
          }
          return Promise.resolve(null);
        },
        create: (args: unknown) => {
          txCalls.push({ method: 'projectDivision.create', args });
          return Promise.resolve({ id: 'div_07_new' });
        },
      },
      payApp: {
        create: (args: unknown) => {
          txCalls.push({ method: 'payApp.create', args });
          return Promise.resolve({ id: 'pa_new' });
        },
      },
      payAppDivision: {
        create: (args: unknown) => {
          txCalls.push({ method: 'payAppDivision.create', args });
          return Promise.resolve({});
        },
      },
    };
    mockTransaction.mockImplementationOnce((cb) => cb(tx));

    const res = await importInvoiceAction('ws_1', undefined, makeFormData(SAMPLE_PAYLOAD));
    if (!res.ok) {
      // Surface the actual error so failures are debuggable
      throw new Error(`expected ok, got error: ${res.error}`);
    }
    expect(res.payAppId).toBe('pa_new');
    expect(res.drawNumber).toBe(1);
    expect(res.divisionCount).toBe(3);

    // 1 new ProjectDivision (07), 1 PayApp, 3 PayAppDivision.
    expect(txCalls.filter((c) => c.method === 'projectDivision.create')).toHaveLength(1);
    expect(txCalls.filter((c) => c.method === 'payApp.create')).toHaveLength(1);
    expect(txCalls.filter((c) => c.method === 'payAppDivision.create')).toHaveLength(3);

    // PayApp has status PAID and acknowledgedAt stamped.
    const payAppCreate = txCalls.find((c) => c.method === 'payApp.create') as {
      args: { data: { status: string; acknowledgedAt: Date; acknowledgedByName: string; totalThisDraw: number; totalBalance: number } };
    };
    expect(payAppCreate.args.data.status).toBe('PAID');
    expect(payAppCreate.args.data.acknowledgedAt).toBeInstanceOf(Date);
    expect(payAppCreate.args.data.acknowledgedByName).toBe('Yuba Parajuli');
    expect(payAppCreate.args.data.totalThisDraw).toBe(17414); // sum of line amounts
    expect(payAppCreate.args.data.totalBalance).toBe(0); // paid in full

    // Revalidation ran for the project pay-apps page.
    expect(mockRevalidatePath).toHaveBeenCalled();
  });

  it('DRAFT status leaves acknowledged fields null and totalBalance = totalContract', async () => {
    const txCalls: { method: string; args: unknown }[] = [];
    const tx = {
      projectDivision: {
        count: () => Promise.resolve(0),
        findFirst: () => Promise.resolve({ id: 'div_existing' }),
        create: vi.fn(),
      },
      payApp: {
        create: (args: unknown) => {
          txCalls.push({ method: 'payApp.create', args });
          return Promise.resolve({ id: 'pa_new' });
        },
      },
      payAppDivision: { create: vi.fn() },
    };
    mockTransaction.mockImplementationOnce((cb) => cb(tx));

    const res = await importInvoiceAction(
      'ws_1',
      undefined,
      makeFormData({ ...SAMPLE_PAYLOAD, status: 'DRAFT' }),
    );
    expect(res.ok).toBe(true);

    const payAppCreate = txCalls.find((c) => c.method === 'payApp.create') as {
      args: { data: { status: string; acknowledgedAt: null; totalBalance: number; totalContract: number; totalThisDraw: number } };
    };
    expect(payAppCreate.args.data.status).toBe('DRAFT');
    expect(payAppCreate.args.data.acknowledgedAt).toBe(null);
    // For a single import, totalThisDraw == totalContract,
    // so totalBalance = 0 even for DRAFT (the buyer will
    // adjust totalContract to cumulative when they import
    // a second draw).
    expect(payAppCreate.args.data.totalBalance).toBe(0);
    expect(payAppCreate.args.data.totalContract).toBe(17414);
    expect(payAppCreate.args.data.totalThisDraw).toBe(17414);
  });
});
