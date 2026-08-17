import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError, requireRole } from '../require-role';

// Mock the Clerk auth() function.
const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

// Mock the Prisma client.
const membershipFindUnique = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    membership: { findUnique: (...args: unknown[]) => membershipFindUnique(...args) },
  },
}));

beforeEach(() => {
  authMock.mockReset();
  membershipFindUnique.mockReset();
});

describe('requireRole', () => {
  it('throws UNAUTHENTICATED when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(requireRole('ws_1', ['OWNER'])).rejects.toThrow(AuthError);
    await expect(requireRole('ws_1', ['OWNER'])).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('throws NOT_A_MEMBER when user has no membership in the workspace', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    membershipFindUnique.mockResolvedValue(null);
    await expect(requireRole('ws_1', ['OWNER'])).rejects.toMatchObject({ code: 'NOT_A_MEMBER' });
  });

  it('throws INSUFFICIENT_ROLE when role is not in the allowed list', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    membershipFindUnique.mockResolvedValue({ role: 'FIELD' });
    await expect(requireRole('ws_1', ['OWNER'])).rejects.toMatchObject({
      code: 'INSUFFICIENT_ROLE',
    });
  });

  it('returns { userId, workspaceId, role } on success', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    membershipFindUnique.mockResolvedValue({ role: 'PM' });
    const result = await requireRole('ws_1', ['PM', 'ADMIN', 'OWNER']);
    expect(result).toEqual({ userId: 'user_1', workspaceId: 'ws_1', role: 'PM' });
  });

  it('accepts MEMBER role when MEMBER is in the allowed list', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    membershipFindUnique.mockResolvedValue({ role: 'MEMBER' });
    await expect(requireRole('ws_1', ['MEMBER', 'FIELD'])).resolves.toBeTruthy();
  });
});
