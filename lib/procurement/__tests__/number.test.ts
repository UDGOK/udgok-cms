import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

// The implementation uses $queryRaw with ON CONFLICT DO UPDATE RETURNING.
// Postgres serializes the per-row update, so this is race-safe by design.
// Our mock captures the SQL and returns a controllable counter value.

const mockQueryRaw = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) }),
  },
}));

import { nextDocNumber } from '../number';

function makeTx(): Prisma.TransactionClient {
  return { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) } as unknown as Prisma.TransactionClient;
}

describe('nextDocNumber', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
    // Default: the SQL returns the new value (1 for the first insert)
    mockQueryRaw.mockResolvedValue([{ value: 1 }]);
  });

  it('returns PO-YYYY-NNNN with current year', async () => {
    const no = await nextDocNumber(makeTx(), 'ws_test', 'PO');
    const year = new Date().getFullYear();
    expect(no).toBe(`PO-${year}-0001`);
  });

  it('returns RFQ-YYYY-NNNN', async () => {
    const no = await nextDocNumber(makeTx(), 'ws_test', 'RFQ');
    const year = new Date().getFullYear();
    expect(no).toBe(`RFQ-${year}-0001`);
  });

  it('pads the counter to 4 digits', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ value: 42 }]);
    const no = await nextDocNumber(makeTx(), 'ws_abc', 'PO');
    const year = new Date().getFullYear();
    expect(no).toBe(`PO-${year}-0042`);
  });

  it('handles large counter values', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ value: 12345 }]);
    const no = await nextDocNumber(makeTx(), 'ws_abc', 'PO');
    const year = new Date().getFullYear();
    expect(no).toBe(`PO-${year}-12345`);
  });

  it('uses the workspaceId in the SQL', async () => {
    await nextDocNumber(makeTx(), 'ws_abc', 'PO');
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    // The first arg is a Prisma.sql template literal — stringify and check
    const callArgs = mockQueryRaw.mock.calls[0] as unknown[];
    expect(callArgs).toContain('ws_abc');
    expect(callArgs).toContain('PO');
  });

  it('uses the current year as the period', async () => {
    const year = new Date().getFullYear();
    await nextDocNumber(makeTx(), 'ws_abc', 'PO');
    const callArgs = mockQueryRaw.mock.calls[0] as unknown[];
    expect(callArgs).toContain(String(year));
  });

  it('returns formatted string even when value is 0 (Postgres BIGSERIAL fallback)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ value: 0 }]);
    const no = await nextDocNumber(makeTx(), 'ws_abc', 'PO');
    const year = new Date().getFullYear();
    expect(no).toBe(`PO-${year}-0000`);
  });

  it('PO and RFQ counters are independent', async () => {
    await nextDocNumber(makeTx(), 'ws_abc', 'PO');
    await nextDocNumber(makeTx(), 'ws_abc', 'RFQ');
    const poCall = mockQueryRaw.mock.calls[0] as unknown[];
    const rfqCall = mockQueryRaw.mock.calls[1] as unknown[];
    expect(poCall).toContain('PO');
    expect(rfqCall).toContain('RFQ');
  });
});
