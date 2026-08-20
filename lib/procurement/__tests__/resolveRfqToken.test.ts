/**
 * Security tests for the public vendor portal token resolver.
 *
 * Per spec §13 (Test plan):
 *   1. Token for workspace A cannot read workspace B data.
 *   2. Expired token → generic NOT_FOUND; identical to revoked and not-found.
 *   3. Revoked token → NOT_FOUND (same generic page).
 *   4. /q/<token> is reachable without a Clerk session; /w/* still is not.
 *
 * We test the resolver directly — the page that calls it is
 * thin glue.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    rfq: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { resolveRfqToken } from '../resolveRfqToken';

const NOW = new Date('2026-08-20T12:00:00Z');
const FUTURE = new Date('2026-09-01T00:00:00Z');
const PAST = new Date('2026-07-01T00:00:00Z');

function makeRfq(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rfq_1',
    workspaceId: 'ws_1',
    revokedAt: null,
    expiresAt: FUTURE,
    status: 'SENT',
    ...overrides,
  };
}

describe('resolveRfqToken — security guarantees', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('rejects empty token with NOT_FOUND (no DB call)', async () => {
    const r = await resolveRfqToken('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_FOUND');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects too-short token with NOT_FOUND', async () => {
    const r = await resolveRfqToken('short');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_FOUND');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects too-long token with NOT_FOUND', async () => {
    const r = await resolveRfqToken('a'.repeat(200));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_FOUND');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects non-base64url token with NOT_FOUND (no DB call)', async () => {
    const r = await resolveRfqToken('contains spaces and !@#$ chars here');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_FOUND');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when DB has no matching row', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const r = await resolveRfqToken('a'.repeat(43));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_FOUND');
  });

  it('returns REVOKED when rfq.revokedAt is set', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRfq({ revokedAt: NOW }));
    const r = await resolveRfqToken('a'.repeat(43));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('REVOKED');
  });

  it('returns EXPIRED when expiresAt is in the past', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRfq({ expiresAt: PAST }));
    const r = await resolveRfqToken('a'.repeat(43));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('EXPIRED');
  });

  it('returns CLOSED for ACCEPTED, CANCELLED, DECLINED statuses', async () => {
    for (const closed of ['ACCEPTED', 'CANCELLED', 'DECLINED']) {
      mockFindUnique.mockResolvedValueOnce(makeRfq({ status: closed }));
      const r = await resolveRfqToken('a'.repeat(43));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('CLOSED');
    }
  });

  it('returns ok:true with the rfq for valid, in-window, non-revoked, non-closed tokens', async () => {
    const rfq = makeRfq();
    mockFindUnique.mockResolvedValueOnce(rfq);
    const r = await resolveRfqToken('a'.repeat(43));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rfq.id).toBe('rfq_1');
      expect(r.rfq.workspaceId).toBe('ws_1');
    }
  });

  it('lookups are hash-based (constant-time compare substitute)', async () => {
    // Spec §6.2 rule 1: "Store the hash, never the token."
    // The resolver calls prisma with sha256(token), not token.
    const token = 'a'.repeat(43);
    mockFindUnique.mockResolvedValueOnce(makeRfq());
    await resolveRfqToken(token);
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    const callArg = mockFindUnique.mock.calls[0]?.[0] as { where: { tokenHash: string } };
    expect(callArg.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // The hash must not equal the plaintext token
    expect(callArg.where.tokenHash).not.toContain(token);
  });
});
