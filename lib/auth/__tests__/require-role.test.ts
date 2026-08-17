import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireRole, getAuthContext, getCurrentUser, getWorkspaceRole } from '../require-role';

// Mock Clerk
const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

// Mock Prisma
const workspaceFindUnique = vi.fn();
const userUpsert = vi.fn();
const userFindUnique = vi.fn();
const membershipFindUnique = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspace: { findUnique: (...args: unknown[]) => workspaceFindUnique(...args) },
    user: {
      upsert: (...args: unknown[]) => userUpsert(...args),
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
    membership: { findUnique: (...args: unknown[]) => membershipFindUnique(...args) },
  },
}));

beforeEach(() => {
  authMock.mockReset();
  currentUserMock.mockReset();
  workspaceFindUnique.mockReset();
  userUpsert.mockReset();
  userFindUnique.mockReset();
  membershipFindUnique.mockReset();
});

// Helper to set up a successful signed-in state
function mockSignedIn(role: 'OWNER' | 'ADMIN' | 'PM' | 'ESTIMATOR' | 'FIELD' | 'MEMBER' = 'OWNER', wsId = 'ws_abc', wsSlug = 'my-ws') {
  authMock.mockResolvedValue({ userId: 'user_1' });
  currentUserMock.mockResolvedValue({
    emailAddresses: [{ emailAddress: 'me@x.com' }],
    firstName: 'Me',
    lastName: '',
    imageUrl: '',
  });
  workspaceFindUnique.mockImplementation(async ({ where }: { where: { id?: string; slug?: string } }) => {
    if (where.id === wsId || where.slug === wsSlug) return { id: wsId, slug: wsSlug, name: 'Test' };
    return null;
  });
  userUpsert.mockResolvedValue({});
  membershipFindUnique.mockResolvedValue({ role });
}

describe('requireRole', () => {
  it('throws AuthError(401) when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(requireRole('ws_1', ['OWNER'])).rejects.toMatchObject({ status: 401 });
  });

  it('throws AuthError(404) when workspace does not exist', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'me@x.com' }],
      firstName: 'Me',
      lastName: '',
      imageUrl: '',
    });
    workspaceFindUnique.mockResolvedValue(null);
    await expect(requireRole('does-not-exist', ['OWNER'])).rejects.toMatchObject({ status: 404 });
  });

  it('throws AuthError(403) when user has no membership in the workspace', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'me@x.com' }],
      firstName: 'Me',
      lastName: '',
      imageUrl: '',
    });
    workspaceFindUnique.mockResolvedValue({ id: 'ws_1', slug: 'x', name: 'X' });
    userUpsert.mockResolvedValue({});
    membershipFindUnique.mockResolvedValue(null);
    await expect(requireRole('ws_1', ['OWNER'])).rejects.toMatchObject({ status: 403 });
  });

  it('throws AuthError(403) when role is not in the allowed list', async () => {
    mockSignedIn('FIELD');
    await expect(requireRole('ws_abc', ['OWNER', 'ADMIN'])).rejects.toMatchObject({ status: 403 });
  });

  it('resolves workspace by id (the 12-byte hex format we use)', async () => {
    mockSignedIn('OWNER', 'a'.repeat(24), 'unused');
    const result = await requireRole('a'.repeat(24), ['OWNER']);
    expect(result.workspaceId).toBe('a'.repeat(24));
    // Confirm we tried by id first
    const firstCall = workspaceFindUnique.mock.calls[0][0];
    expect(firstCall.where.id).toBe('a'.repeat(24));
  });

  it('resolves workspace by slug when id lookup fails', async () => {
    mockSignedIn('OWNER', 'ws_abc', 'my-ws');
    const result = await requireRole('my-ws', ['OWNER']);
    expect(result.workspaceId).toBe('ws_abc');
    // First call tried by id (failed), second tried by slug
    expect(workspaceFindUnique).toHaveBeenCalledTimes(2);
    expect(workspaceFindUnique.mock.calls[0][0].where.id).toBe('my-ws');
    expect(workspaceFindUnique.mock.calls[1][0].where.slug).toBe('my-ws');
  });

  it('resolves Clerk-style org_ id', async () => {
    mockSignedIn('OWNER', 'org_2abc123', 'unused');
    const result = await requireRole('org_2abc123', ['OWNER']);
    expect(result.workspaceId).toBe('org_2abc123');
  });

  it('returns AuthContext on success with allowed role', async () => {
    mockSignedIn('PM');
    const result = await requireRole('ws_abc', ['PM', 'ADMIN', 'OWNER']);
    expect(result).toMatchObject({
      userId: 'user_1',
      workspaceId: 'ws_abc',
      role: 'PM',
      email: 'me@x.com',
    });
  });

  it('upserts the user (best-effort)', async () => {
    mockSignedIn('OWNER');
    await requireRole('ws_abc', ['OWNER']);
    expect(userUpsert).toHaveBeenCalled();
  });
});

describe('getAuthContext', () => {
  it('returns null for unauthenticated when wrapped (returns throws)', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(getAuthContext('ws_abc')).rejects.toMatchObject({ status: 401 });
  });
});

describe('getCurrentUser', () => {
  it('returns null when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    const u = await getCurrentUser();
    expect(u).toBeNull();
  });

  it('returns the user from DB when signed in', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    userFindUnique.mockResolvedValue({ id: 'user_1', email: 'me@x.com' });
    const u = await getCurrentUser();
    expect(u).toEqual({ id: 'user_1', email: 'me@x.com' });
  });
});

describe('getWorkspaceRole', () => {
  it('returns null when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    expect(await getWorkspaceRole('ws_abc')).toBeNull();
  });

  it('returns the role on success', async () => {
    mockSignedIn('ADMIN');
    expect(await getWorkspaceRole('ws_abc')).toBe('ADMIN');
  });

  it('returns null on any auth failure', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'me@x.com' }],
      firstName: 'Me',
      lastName: '',
      imageUrl: '',
    });
    workspaceFindUnique.mockResolvedValue(null);
    expect(await getWorkspaceRole('nope')).toBeNull();
  });
});
