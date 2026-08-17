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
const projectDivisionAggregate = vi.fn();
const projectDivisionCreate = vi.fn();
const userUpsert = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspace: { findUnique: (...args: unknown[]) => workspaceFindUnique(...args) },
    project: { findFirst: (...args: unknown[]) => projectFindFirst(...args) },
    projectDivision: {
      aggregate: (...args: unknown[]) => projectDivisionAggregate(...args),
      create: (...args: unknown[]) => projectDivisionCreate(...args),
    },
    user: { upsert: (...args: unknown[]) => userUpsert(...args) },
  },
}));

// Mock requireRole (real requireRole is exercised in its own tests)
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

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createDivisionAction } from '../actions';

beforeEach(() => {
  authMock.mockReset();
  currentUserMock.mockReset();
  workspaceFindUnique.mockReset();
  projectFindFirst.mockReset();
  projectDivisionAggregate.mockReset();
  projectDivisionCreate.mockReset();
  userUpsert.mockReset();
});

function mockFormData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

describe('createDivisionAction', () => {
  it('creates a division with all fields and assigns the next sortOrder', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'me@x.com' }],
      firstName: 'Me',
      lastName: '',
      imageUrl: '',
    });
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1', slug: 'my-ws' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1', workspaceId: 'ws_1' });
    projectDivisionAggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    projectDivisionCreate.mockResolvedValue({});

    const result = await createDivisionAction('my-ws', 'proj_1', undefined, mockFormData({
      code: '01',
      trade: 'Site prep',
      subcontractorName: 'Acme',
      budget: '5000',
    }));

    expect(result).toEqual({ ok: true });
    expect(projectDivisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj_1',
        code: '01',
        trade: 'Site prep',
        subcontractorName: 'Acme',
        budget: 5000,
        sortOrder: 3, // max(2) + 1
      }),
    });
  });

  it('handles a missing subcontractor (optional field)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1', slug: 'my-ws' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1' });
    projectDivisionAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    projectDivisionCreate.mockResolvedValue({});

    const result = await createDivisionAction('my-ws', 'proj_1', undefined, mockFormData({
      code: '02',
      trade: 'Framing',
      budget: '12000',
    }));

    expect(result).toEqual({ ok: true });
    expect(projectDivisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subcontractorName: undefined,
        budget: 12000,
        sortOrder: 1,
      }),
    });
  });

  it('returns field error when code is missing', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1' });

    const result = await createDivisionAction('my-ws', 'proj_1', undefined, mockFormData({
      trade: 'Framing',
      budget: '100',
    }));

    expect(result?.fieldErrors?.code).toBeTruthy();
    expect(projectDivisionCreate).not.toHaveBeenCalled();
  });

  it('returns field error when budget is negative', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
    projectFindFirst.mockResolvedValue({ id: 'proj_1' });

    const result = await createDivisionAction('my-ws', 'proj_1', undefined, mockFormData({
      code: '01',
      trade: 'Framing',
      budget: '-100',
    }));

    expect(result?.fieldErrors?.budget).toBeTruthy();
    expect(projectDivisionCreate).not.toHaveBeenCalled();
  });

  it('returns "Project not found" if project is not in this workspace', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue(null);
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
    projectFindFirst.mockResolvedValue(null); // wrong workspace or doesn't exist

    const result = await createDivisionAction('my-ws', 'proj_wrong', undefined, mockFormData({
      code: '01',
      trade: 'Framing',
      budget: '100',
    }));

    expect(result).toEqual({ error: 'Project not found' });
    expect(projectDivisionCreate).not.toHaveBeenCalled();
  });
});
