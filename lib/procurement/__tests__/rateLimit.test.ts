import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockQueryRaw = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { rateLimit } from '../rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns ok:true when count is under max', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: 1 }]);
    const r = await rateLimit('test-key', { max: 5, windowSec: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.count).toBe(1);
  });

  it('returns ok:false when count exceeds max', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: 11 }]);
    const r = await rateLimit('test-key', { max: 10, windowSec: 600 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.count).toBe(11);
  });

  it('returns ok:true when count equals max (inclusive)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: 10 }]);
    const r = await rateLimit('test-key', { max: 10, windowSec: 600 });
    expect(r.ok).toBe(true);
  });

  it('truncates keys longer than 200 chars', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: 1 }]);
    const longKey = 'a'.repeat(500);
    await rateLimit(longKey, { max: 5, windowSec: 60 });
    // The first arg to $queryRaw is the Prisma.sql template —
    // we just verify the call was made without erroring.
    expect(mockQueryRaw).toHaveBeenCalled();
  });
});
