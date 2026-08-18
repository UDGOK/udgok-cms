import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for convertDealToProjectAction. The mocks are designed
 * so each test sets up only the Prisma calls it needs, in the
 * order the action makes them.
 *
 * Order of Prisma calls in the happy path:
 *   1. deal.findFirst (verify deal exists + load convertedProject)
 *   2. project.findFirst (check for name collision)
 *   3. $transaction callback
 *      3a. project.create
 *      3b. file.updateMany (migrate deal files)
 *      3c. deal.update (mark WON, only if not already WON/LOST)
 */

// Clerk
const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

// Prisma mocks — one for every call the action makes
const dealFindFirst = vi.fn();
const dealUpdate = vi.fn();
const projectFindFirst = vi.fn();
const projectCreate = vi.fn();
const fileUpdateMany = vi.fn();

// $transaction runs the callback with a transactional client
const transactionMock = vi.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    project: { create: projectCreate },
    file: { updateMany: fileUpdateMany },
    deal: { update: dealUpdate },
  };
  return cb(tx);
});

vi.mock('@/lib/db/client', () => ({
  prisma: {
    deal: {
      findFirst: (...args: unknown[]) => dealFindFirst(...args),
      update: (...args: unknown[]) => dealUpdate(...args),
    },
    project: {
      findFirst: (...args: unknown[]) => projectFindFirst(...args),
      create: (...args: unknown[]) => projectCreate(...args),
    },
    file: { updateMany: (...args: unknown[]) => fileUpdateMany(...args) },
    $transaction: (cb: (tx: unknown) => unknown) => transactionMock(cb),
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
  getWorkspace: vi.fn().mockResolvedValue({ id: 'ws_1', slug: 'my-ws', name: 'Test' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { convertDealToProjectAction } from '../actions';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'user_1' });
  // Default: deal found, no converted project, no name collision.
  // Each test overrides as needed.
  dealFindFirst.mockResolvedValue({
    id: 'deal_1',
    title: 'New Hospital Wing',
    description: 'Phase 1 of expansion',
    value: 1_500_000,
    clientId: 'client_1',
    stage: 'NEGOTIATING',
    closedAt: null,
    convertedProject: null,
  });
  projectFindFirst.mockResolvedValue(null); // no name collision
  projectCreate.mockResolvedValue({ id: 'proj_new' });
  fileUpdateMany.mockResolvedValue({ count: 2 });
  dealUpdate.mockResolvedValue({});
});

describe('convertDealToProjectAction — happy path', () => {
  it('creates a project, migrates files, and marks the deal WON', async () => {
    const res = await convertDealToProjectAction('my-ws', 'deal_1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.projectId).toBe('proj_new');
    expect(res.alreadyConverted).toBe(false);
    // Project creation pulled the deal's title, client, value, description
    expect(projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          clientId: 'client_1',
          dealId: 'deal_1',
          name: 'New Hospital Wing',
          description: 'Phase 1 of expansion',
          contractValue: 1_500_000,
          status: 'ACTIVE',
        }),
      }),
    );
    // Files migrated from deal to project
    expect(fileUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dealId: 'deal_1', workspaceId: 'ws_1' },
        data: { dealId: null, projectId: 'proj_new' },
      }),
    );
    // Deal was in NEGOTIATING — should be bumped to WON
    expect(dealUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'deal_1' },
        data: expect.objectContaining({ stage: 'WON' }),
      }),
    );
  });

  it('does not touch a deal that is already WON (no-op for the stage update)', async () => {
    dealFindFirst.mockResolvedValue({
      id: 'deal_2',
      title: 'Already Won',
      description: null,
      value: 100,
      clientId: 'client_1',
      stage: 'WON',
      closedAt: new Date('2026-01-01'),
      convertedProject: null,
    });
    const res = await convertDealToProjectAction('my-ws', 'deal_2');
    expect(res.ok).toBe(true);
    expect(dealUpdate).not.toHaveBeenCalled();
  });

  it('does not touch a deal that is already LOST', async () => {
    dealFindFirst.mockResolvedValue({
      id: 'deal_3',
      title: 'Lost It',
      description: null,
      value: 50,
      clientId: 'client_1',
      stage: 'LOST',
      closedAt: null,
      convertedProject: null,
    });
    const res = await convertDealToProjectAction('my-ws', 'deal_3');
    expect(res.ok).toBe(true);
    expect(dealUpdate).not.toHaveBeenCalled();
  });
});

describe('convertDealToProjectAction — idempotency', () => {
  it('returns the existing project when a project already exists for this deal', async () => {
    dealFindFirst.mockResolvedValue({
      id: 'deal_4',
      title: 'Re-convert',
      description: null,
      value: 200,
      clientId: 'client_1',
      stage: 'WON',
      closedAt: new Date(),
      convertedProject: { id: 'proj_existing' },
    });
    const res = await convertDealToProjectAction('my-ws', 'deal_4');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.projectId).toBe('proj_existing');
    expect(res.alreadyConverted).toBe(true);
    // Crucially, no NEW project was created
    expect(projectCreate).not.toHaveBeenCalled();
    expect(fileUpdateMany).not.toHaveBeenCalled();
    expect(dealUpdate).not.toHaveBeenCalled();
  });
});

describe('convertDealToProjectAction — name collisions', () => {
  it('suffixes the project name with the deal id short-hash when a same-named project exists', async () => {
    projectFindFirst.mockResolvedValue({ id: 'proj_other', name: 'New Hospital Wing' });
    const res = await convertDealToProjectAction('my-ws', 'deal_1');
    expect(res.ok).toBe(true);
    const createCall = projectCreate.mock.calls[0][0] as { data: { name: string } };
    expect(createCall.data.name).toMatch(/^New Hospital Wing \(from deal deal_1\)/);
  });

  it('uses the deal title verbatim when no name collision', async () => {
    projectFindFirst.mockResolvedValue(null);
    const res = await convertDealToProjectAction('my-ws', 'deal_1');
    expect(res.ok).toBe(true);
    const createCall = projectCreate.mock.calls[0][0] as { data: { name: string } };
    expect(createCall.data.name).toBe('New Hospital Wing');
  });
});

describe('convertDealToProjectAction — error paths', () => {
  it('rejects when no user is signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await convertDealToProjectAction('my-ws', 'deal_1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/sign/i);
    expect(projectCreate).not.toHaveBeenCalled();
  });

  it('returns "Deal not found" when the deal id does not exist', async () => {
    dealFindFirst.mockResolvedValue(null);
    const res = await convertDealToProjectAction('my-ws', 'deal_ghost');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('Deal not found');
    expect(projectCreate).not.toHaveBeenCalled();
  });
});
