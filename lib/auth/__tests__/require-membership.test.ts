import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();
const workspaceFindUnique = vi.fn();
const membershipFindUnique = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspace: { findUnique: (...args: unknown[]) => workspaceFindUnique(...args) },
    membership: { findUnique: (...args: unknown[]) => membershipFindUnique(...args) },
  },
}));

// Mock next/navigation so redirect/notFound throw with what we can assert
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    const e = new Error(`NEXT_REDIRECT:${path}`);
    (e as Error & { _isRedirect: boolean })._isRedirect = true;
    throw e;
  },
  notFound: () => {
    const e = new Error('NEXT_NOT_FOUND');
    (e as Error & { _isNotFound: boolean })._isNotFound = true;
    throw e;
  },
}));

import { requireMembership } from '../require-membership';

beforeEach(() => {
  authMock.mockReset();
  workspaceFindUnique.mockReset();
  membershipFindUnique.mockReset();
});

describe('requireMembership', () => {
  it('returns ctx when user is a member of the workspace', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    workspaceFindUnique.mockResolvedValue({
      id: 'ws_1',
      slug: 'my-ws',
      name: 'My Workspace',
      industry: 'Construction',
    });
    membershipFindUnique.mockResolvedValue({ id: 'mem_1', role: 'OWNER' });

    const ctx = await requireMembership('my-ws');
    expect(ctx).toEqual({
      userId: 'user_1',
      workspace: { id: 'ws_1', slug: 'my-ws', name: 'My Workspace', industry: 'Construction' },
      membership: { id: 'mem_1', role: 'OWNER' },
    });
  });

  it('redirects to /sign-in when user is not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(requireMembership('my-ws')).rejects.toThrow('NEXT_REDIRECT:/sign-in');
  });

  it('calls notFound() when the workspace does not exist', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    workspaceFindUnique.mockResolvedValue(null);
    await expect(requireMembership('does-not-exist')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('redirects to /workspaces when user has no membership', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1', slug: 'x', name: 'X', industry: null });
    membershipFindUnique.mockResolvedValue(null);
    await expect(requireMembership('x')).rejects.toThrow('NEXT_REDIRECT:/workspaces');
  });
});
