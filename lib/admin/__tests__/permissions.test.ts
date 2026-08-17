import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the module
const mockUserFind = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFind(...args) },
  },
}));

// Mock clerk auth (no longer needed but kept harmless)
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'test-user-id' })),
}));

import { isMasterAdmin, listMasterAdminEmails } from '../permissions';

describe('isMasterAdmin', () => {
  beforeEach(() => {
    mockUserFind.mockReset();
  });

  it('returns false for null/undefined userId', async () => {
    expect(await isMasterAdmin(null)).toBe(false);
    expect(await isMasterAdmin(undefined)).toBe(false);
    expect(await isMasterAdmin('')).toBe(false);
  });

  it('returns false when user is not found', async () => {
    mockUserFind.mockResolvedValueOnce(null);
    expect(await isMasterAdmin('user-id')).toBe(false);
  });

  it('returns true for default master email (yasir@udgok.com)', async () => {
    mockUserFind.mockResolvedValueOnce({ email: 'yasir@udgok.com' });
    expect(await isMasterAdmin('user-id')).toBe(true);
  });

  it('matches email case-insensitively', async () => {
    mockUserFind.mockResolvedValueOnce({ email: 'YASIR@UDGOK.COM' });
    expect(await isMasterAdmin('user-id')).toBe(true);
  });

  it('returns false for non-master email', async () => {
    mockUserFind.mockResolvedValueOnce({ email: 'random@example.com' });
    expect(await isMasterAdmin('user-id')).toBe(false);
  });
});

describe('listMasterAdminEmails', () => {
  it('always includes the default master (yasir@udgok.com)', () => {
    const emails = listMasterAdminEmails();
    expect(emails).toContain('yasir@udgok.com');
  });
});
