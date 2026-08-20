// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Estimate action tests — state machine + permissions.
 *
 * Mirrors the approval-workflow test pattern: mock
 * Prisma + Clerk + role gate, assert the right
 * mutation runs with the right fields under each
 * scenario.
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
  estimateCreateMock,
  estimateUpdateMock,
  estimateFindFirstMock,
  estimateFindUniqueMock,
  estimateCountMock,
  clientFindFirstMock,
  projectFindFirstMock,
  dealFindFirstMock,
  dealUpdateMock,
  membershipFindUniqueMock,
} = vi.hoisted(() => ({
  estimateCreateMock: vi.fn(),
  estimateUpdateMock: vi.fn(),
  estimateFindFirstMock: vi.fn(),
  estimateFindUniqueMock: vi.fn(),
  estimateCountMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  projectFindFirstMock: vi.fn(),
  dealFindFirstMock: vi.fn(),
  dealUpdateMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    estimate: {
      create: (...a: unknown[]) => estimateCreateMock(...a),
      update: (...a: unknown[]) => estimateUpdateMock(...a),
      findFirst: (...a: unknown[]) => estimateFindFirstMock(...a),
      findUnique: (...a: unknown[]) => estimateFindUniqueMock(...a),
      count: (...a: unknown[]) => estimateCountMock(...a),
    },
    client: { findFirst: (...a: unknown[]) => clientFindFirstMock(...a) },
    project: { findFirst: (...a: unknown[]) => projectFindFirstMock(...a) },
    deal: {
      findFirst: (...a: unknown[]) => dealFindFirstMock(...a),
      update: (...a: unknown[]) => dealUpdateMock(...a),
    },
    membership: { findUnique: (...a: unknown[]) => membershipFindUniqueMock(...a) },
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  createEstimateAction,
  sendEstimateAction,
  publicApproveEstimateAction,
  publicRejectEstimateAction,
  convertEstimateToProjectAction,
  voidEstimateAction,
} from '../actions';

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
  // Default: client / project / deal all valid.
  clientFindFirstMock.mockResolvedValue({ id: 'c_1' });
  projectFindFirstMock.mockResolvedValue({ id: 'p_1' });
  dealFindFirstMock.mockResolvedValue({ id: 'd_1' });
  estimateCountMock.mockResolvedValue(0);
  estimateCreateMock.mockResolvedValue({ id: 'est_1', shareToken: null });
  estimateUpdateMock.mockResolvedValue({ id: 'est_1' });
  estimateFindFirstMock.mockResolvedValue({
    id: 'est_1',
    status: 'DRAFT',
    dealId: null,
  });
  estimateFindUniqueMock.mockResolvedValue({
    id: 'est_1',
    status: 'SENT',
    dealId: null,
    workspaceId: 'ws_1',
  });
  dealUpdateMock.mockResolvedValue({ id: 'd_1' });
  membershipFindUniqueMock.mockResolvedValue({ role: 'PM' });
});

describe('createEstimateAction', () => {
  it('creates a DRAFT estimate with computed totals', async () => {
    const lineItems = [
      { description: 'Tile', quantity: 100, unit: 'SF', unitPrice: 25 },
      { description: 'Grout', quantity: 100, unit: 'SF', unitPrice: 5 },
    ];
    const res = await createEstimateAction(
      'udgok',
      undefined,
      fd({
        clientId: 'c_1',
        title: 'Test estimate',
        lineItems: JSON.stringify(lineItems),
      }),
    );
    expect(res.ok).toBe(true);
    expect(estimateCreateMock).toHaveBeenCalledTimes(1);
    const data = estimateCreateMock.mock.calls[0][0].data;
    // 100*25 + 100*5 = 2500 + 500 = 3000
    expect(data.subtotal).toBe(3000);
    expect(data.total).toBe(3000);
    // Status has a Prisma default of DRAFT; the action
    // doesn't set it explicitly.
    expect(data.lineItems.create).toHaveLength(2);
  });

  it('applies tax rate when set', async () => {
    const res = await createEstimateAction(
      'udgok',
      undefined,
      fd({
        clientId: 'c_1',
        title: 'Test',
        taxRate: '0.0825', // 8.25%
        lineItems: JSON.stringify([
          { description: 'Item', quantity: 1, unit: 'EA', unitPrice: 1000 },
        ]),
      }),
    );
    expect(res.ok).toBe(true);
    const data = estimateCreateMock.mock.calls[0][0].data;
    // 1000 + 82.50 = 1082.50
    expect(data.subtotal).toBe(1000);
    expect(data.taxAmount).toBe(82.5);
    expect(data.total).toBe(1082.5);
  });

  it('refuses when no line items', async () => {
    const res = await createEstimateAction(
      'udgok',
      undefined,
      fd({
        clientId: 'c_1',
        title: 'Test',
        lineItems: '[]',
      }),
    );
    expect(res.ok).toBe(false);
  });

  it('refuses when client is missing', async () => {
    const res = await createEstimateAction(
      'udgok',
      undefined,
      fd({
        title: 'Test',
        lineItems: JSON.stringify([
          { description: 'x', quantity: 1, unit: 'EA', unitPrice: 1 },
        ]),
      }),
    );
    expect(res.ok).toBe(false);
  });

  it('refuses when client is not in this workspace', async () => {
    clientFindFirstMock.mockResolvedValue(null);
    const res = await createEstimateAction(
      'udgok',
      undefined,
      fd({
        clientId: 'c_other',
        title: 'Test',
        lineItems: JSON.stringify([
          { description: 'x', quantity: 1, unit: 'EA', unitPrice: 1 },
        ]),
      }),
    );
    expect(res.ok).toBe(false);
  });
});

describe('sendEstimateAction', () => {
  it('DRAFT → SENT and generates a share token', async () => {
    const res = await sendEstimateAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(true);
    expect(res.shareToken).toBeTruthy();
    // Share token is a 32-char base64url string
    // (24 bytes encoded).
    expect(res.shareToken!.length).toBeGreaterThanOrEqual(32);
    const data = estimateUpdateMock.mock.calls[0][0].data;
    expect(data.status).toBe('SENT');
    expect(data.shareToken).toBeTruthy();
    expect(data.sentAt).toBeInstanceOf(Date);
  });

  it('refuses to send a non-DRAFT estimate', async () => {
    estimateFindFirstMock.mockResolvedValue({ id: 'est_1', status: 'SENT', dealId: null });
    const res = await sendEstimateAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/draft/i);
    }
  });

  it('bumps the deal stage to ESTIMATE_SENT when a deal is attached', async () => {
    estimateFindFirstMock.mockResolvedValue({ id: 'est_1', status: 'DRAFT', dealId: 'd_1' });
    const res = await sendEstimateAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(true);
    expect(dealUpdateMock).toHaveBeenCalledWith({
      where: { id: 'd_1' },
      data: { stage: 'ESTIMATE_SENT' },
    });
  });
});

describe('publicApproveEstimateAction', () => {
  it('SENT/VIEWED → APPROVED with typed email as audit', async () => {
    const res = await publicApproveEstimateAction(
      undefined,
      fd({
        token: 'abc123token',
        name: 'Bob Client',
        email: 'bob@client.com',
      }),
    );
    expect(res.ok).toBe(true);
    const data = estimateUpdateMock.mock.calls[0][0].data;
    expect(data.status).toBe('APPROVED');
    expect(data.approvedByEmail).toBe('bob@client.com');
    expect(data.approvedByName).toBe('Bob Client');
  });

  it('bumps deal stage to WON on approval', async () => {
    estimateFindUniqueMock.mockResolvedValue({
      id: 'est_1',
      status: 'VIEWED',
      dealId: 'd_1',
      workspaceId: 'ws_1',
    });
    const res = await publicApproveEstimateAction(
      undefined,
      fd({
        token: 'abc123token',
        name: 'Bob',
        email: 'bob@c.com',
      }),
    );
    expect(res.ok).toBe(true);
    expect(dealUpdateMock).toHaveBeenCalledWith({
      where: { id: 'd_1' },
      data: { stage: 'WON' },
    });
  });

  it('rejects on invalid email', async () => {
    const res = await publicApproveEstimateAction(
      undefined,
      fd({ token: 't', name: 'X', email: 'not-an-email' }),
    );
    expect(res.ok).toBe(false);
  });

  it('refuses if estimate is already APPROVED', async () => {
    estimateFindUniqueMock.mockResolvedValue({
      id: 'est_1',
      status: 'APPROVED',
      dealId: null,
      workspaceId: 'ws_1',
    });
    const res = await publicApproveEstimateAction(
      undefined,
      fd({ token: 't', name: 'X', email: 'x@y.com' }),
    );
    expect(res.ok).toBe(false);
  });
});

describe('publicRejectEstimateAction', () => {
  it('requires a note', async () => {
    const res = await publicRejectEstimateAction(
      undefined,
      fd({ token: 't', name: 'X', email: 'x@y.com' }),
    );
    expect(res.ok).toBe(false);
  });

  it('SENT/VIEWED → REJECTED with note + email', async () => {
    const res = await publicRejectEstimateAction(
      undefined,
      fd({
        token: 't',
        name: 'Bob',
        email: 'bob@c.com',
        note: 'Too expensive',
      }),
    );
    expect(res.ok).toBe(true);
    const data = estimateUpdateMock.mock.calls[0][0].data;
    expect(data.status).toBe('REJECTED');
    expect(data.rejectNote).toBe('Too expensive');
    expect(data.rejectedByEmail).toBe('bob@c.com');
  });
});

describe('convertEstimateToProjectAction', () => {
  it('creates a Project + transitions to CONVERTED', async () => {
    // Need a fresh prisma mock for the transaction —
    // the action calls tx.project.create then
    // tx.estimate.update. The default mocks return
    // empty objects which is enough for the test.
    const { prisma } = await import('@/lib/db/client');
    const txMock = {
      project: {
        create: vi.fn().mockResolvedValue({ id: 'proj_new' }),
      },
      estimate: {
        update: vi.fn().mockResolvedValue({ id: 'est_1' }),
      },
    };
    // Override the prisma mock for this test only.
    (prisma as unknown as { $transaction: (fn: (tx: typeof txMock) => Promise<unknown>) => Promise<unknown> }).$transaction = (fn) =>
      fn(txMock);

    estimateFindFirstMock.mockResolvedValue({
      id: 'est_1',
      status: 'APPROVED',
      convertedProjectId: null,
      title: 'Tile job',
      description: 'Master bath',
      clientId: 'c_1',
      projectId: null,
      total: 5000,
      number: 'EST-2026-0001',
    });

    const res = await convertEstimateToProjectAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(true);
    expect(res.projectId).toBe('proj_new');
    // The project was created with the right data.
    const projectCreateCall = txMock.project.create.mock.calls[0][0];
    expect(projectCreateCall.data.name).toBe('Tile job');
    expect(projectCreateCall.data.contractValue).toBe(5000);
    expect(projectCreateCall.data.status).toBe('ACTIVE');
    // The estimate was updated to CONVERTED.
    const estimateUpdateCall = txMock.estimate.update.mock.calls[0][0];
    expect(estimateUpdateCall.data.status).toBe('CONVERTED');
    expect(estimateUpdateCall.data.convertedProjectId).toBe('proj_new');
  });

  it('refuses to convert a non-APPROVED estimate', async () => {
    estimateFindFirstMock.mockResolvedValue({
      id: 'est_1',
      status: 'DRAFT',
      convertedProjectId: null,
      title: 'X',
      description: null,
      clientId: 'c_1',
      projectId: null,
      total: 100,
      number: 'EST-2026-0001',
    });
    const res = await convertEstimateToProjectAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(false);
  });

  it('uses pendingProjectName when set, not the estimate title', async () => {
    // Admin picked "Create new project" on the form and
    // typed a custom name. The converted project should
    // use that name + the optional code, not the
    // estimate title.
    const { prisma } = await import('@/lib/db/client');
    const txMock = {
      project: {
        create: vi.fn().mockResolvedValue({ id: 'proj_new' }),
      },
      estimate: {
        update: vi.fn().mockResolvedValue({ id: 'est_1' }),
      },
    };
    (prisma as unknown as { $transaction: (fn: (tx: typeof txMock) => Promise<unknown>) => Promise<unknown> }).$transaction = (fn) =>
      fn(txMock);

    estimateFindFirstMock.mockResolvedValue({
      id: 'est_1',
      status: 'APPROVED',
      convertedProjectId: null,
      title: 'Build-out for Coldstone',  // estimate title
      description: 'Master bath scope',
      clientId: 'c_1',
      projectId: null,  // NOT linked to existing project
      total: 5000,
      number: 'EST-2026-0001',
      // The new fields: admin named the future project.
      pendingProjectName: 'Coldstone Creamery / Wetzel\'s Pretzels — Build-Out',
      pendingProjectCode: 'CSC-2026-01',
    });

    const res = await convertEstimateToProjectAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(true);
    const projectCreateCall = txMock.project.create.mock.calls[0][0];
    // The new project uses pendingProjectName, not the estimate title.
    expect(projectCreateCall.data.name).toBe("Coldstone Creamery / Wetzel's Pretzels — Build-Out");
    expect(projectCreateCall.data.code).toBe('CSC-2026-01');
  });

  it('falls back to estimate title when pendingProjectName is null', async () => {
    // Legacy: admin left project source as "None" — convert
    // uses the estimate title. This is the original behavior
    // and we want to keep it working.
    const { prisma } = await import('@/lib/db/client');
    const txMock = {
      project: {
        create: vi.fn().mockResolvedValue({ id: 'proj_legacy' }),
      },
      estimate: {
        update: vi.fn().mockResolvedValue({ id: 'est_1' }),
      },
    };
    (prisma as unknown as { $transaction: (fn: (tx: typeof txMock) => Promise<unknown>) => Promise<unknown> }).$transaction = (fn) =>
      fn(txMock);

    estimateFindFirstMock.mockResolvedValue({
      id: 'est_1',
      status: 'APPROVED',
      convertedProjectId: null,
      title: 'Legacy estimate title',
      description: null,
      clientId: 'c_1',
      projectId: null,
      total: 1000,
      number: 'EST-2026-0002',
      pendingProjectName: null,
      pendingProjectCode: null,
    });

    const res = await convertEstimateToProjectAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(true);
    const projectCreateCall = txMock.project.create.mock.calls[0][0];
    expect(projectCreateCall.data.name).toBe('Legacy estimate title');
    expect(projectCreateCall.data.code).toBeNull();
  });
});

describe('voidEstimateAction', () => {
  it('transitions to REJECTED with "Voided by admin" note', async () => {
    estimateFindFirstMock.mockResolvedValue({
      id: 'est_1',
      status: 'SENT',
      convertedProjectId: null,
    });
    const res = await voidEstimateAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(true);
    const data = estimateUpdateMock.mock.calls[0][0].data;
    expect(data.status).toBe('REJECTED');
    expect(data.rejectNote).toBe('Voided by admin');
  });

  it('refuses to void a converted estimate', async () => {
    estimateFindFirstMock.mockResolvedValue({
      id: 'est_1',
      status: 'CONVERTED',
      convertedProjectId: 'proj_1',
    });
    const res = await voidEstimateAction(
      'udgok',
      undefined,
      fd({ id: 'est_1' }),
    );
    expect(res.ok).toBe(false);
  });
});
