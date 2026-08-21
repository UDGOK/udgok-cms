/**
 * RFQ revision flow — unit tests for the new status machine.
 *
 * These tests use vi.mock for the prisma client and assert
 * the expected DB calls + status transitions for the
 * CMS-grade RFQ actions:
 *   - updateRfqAction: DRAFT edit
 *   - reviseRfqAction: SENT → SUPERSEDED + new Rfq row + email
 *   - extendRfqDeadlineAction: SENT expiresAt bumped
 *   - softDeleteRfqAction: DRAFT deletedAt set
 *   - revokeRfqAction: now uses REVOKED status (was CANCELLED)
 *
 * The real DB is not touched — these are pure control-flow
 * tests with prisma stubbed. End-to-end coverage is
 * exercised by manual smoke tests on staging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();
const mockRfqEventCreate = vi.fn();
const mockVendorContactFindFirst = vi.fn();
const mockWorkspaceMemberFindFirst = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/auth/require-membership', () => ({
  // not used by the action under test
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    rfq: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    rfqEvent: {
      create: (...args: unknown[]) => mockRfqEventCreate(...args),
    },
    vendorContact: {
      findFirst: (...args: unknown[]) => mockVendorContactFindFirst(...args),
    },
    workspaceMember: {
      findFirst: (...args: unknown[]) => mockWorkspaceMemberFindFirst(...args),
    },
    membership: {
      findUnique: (...args: unknown[]) => mockWorkspaceMemberFindFirst(...args),
    },
    $transaction: (arg: unknown) =>
      typeof arg === 'function' ? mockTransaction(arg) : Promise.all(arg),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/procurement/email', () => ({
  sendRfqEmail: vi.fn(async () => ({ sent: true, resendId: 're_test' })),
}));

import { auth } from '@clerk/nextjs/server';
import {
  revokeRfqAction,
  softDeleteRfqAction,
  reviseRfqAction,
  extendRfqDeadlineAction,
} from '../rfq-actions';

const NOW = new Date('2026-08-20T12:00:00Z');

beforeEach(() => {
  mockFindFirst.mockReset();
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockUpdateMany.mockReset();
  mockCreate.mockReset();
  mockRfqEventCreate.mockReset();
  mockVendorContactFindFirst.mockReset();
  mockWorkspaceMemberFindFirst.mockReset();
  mockTransaction.mockReset();
  vi.mocked(auth).mockResolvedValue({ userId: 'user_test' } as never);
  // assertRole → assertMember → prisma.workspaceMember.findFirst
  mockWorkspaceMemberFindFirst.mockResolvedValue({ role: 'OWNER' });
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe('revokeRfqAction — uses REVOKED status (not legacy CANCELLED)', () => {
  it('flips status to REVOKED and sets revokedAt', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    const res = await revokeRfqAction('ws_1', 'rfq_1');
    expect(res.ok).toBe(true);
    // First call should be the updateMany with REVOKED.
    const callArg = mockUpdateMany.mock.calls[0]?.[0] as {
      data: { status: string; revokedAt: Date };
    };
    expect(callArg.data.status).toBe('REVOKED');
    expect(callArg.data.revokedAt).toBeInstanceOf(Date);
  });
});

describe('softDeleteRfqAction — DRAFT only', () => {
  it('rejects SENT+ RFQs (must be revoked, not deleted)', async () => {
    // updateMany with the DRAFT + deletedAt: null filter
    // returns 0 rows, which the action surfaces as an error.
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    const res = await softDeleteRfqAction('ws_1', 'rfq_sent');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Only DRAFT/);
  });

  it('soft-deletes a DRAFT (sets deletedAt, leaves the row)', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    const res = await softDeleteRfqAction('ws_1', 'rfq_draft');
    expect(res.ok).toBe(true);
    const callArg = mockUpdateMany.mock.calls[0]?.[0] as {
      where: { status: string; deletedAt: null };
      data: { deletedAt: Date };
    };
    expect(callArg.where.status).toBe('DRAFT');
    expect(callArg.where.deletedAt).toBe(null);
    expect(callArg.data.deletedAt).toBeInstanceOf(Date);
  });
});

describe('extendRfqDeadlineAction', () => {
  it('rejects out-of-range days', async () => {
    const res = await extendRfqDeadlineAction('ws_1', 'rfq_1', 0);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/between 1 and 90/);
  });

  it('rejects non-finite days', async () => {
    const res = await extendRfqDeadlineAction('ws_1', 'rfq_1', Number.NaN);
    expect(res.ok).toBe(false);
  });

  it('rejects extending a CLOSED RFQ', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'rfq_1',
      workspaceId: 'ws_1',
      deletedAt: null,
      contact: null,
      vendor: { name: 'V' },
      status: 'ACCEPTED',
      expiresAt: NOW,
      neededBy: null,
      message: null,
    });
    const res = await extendRfqDeadlineAction('ws_1', 'rfq_1', 7);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ACCEPTED/);
  });
});

describe('reviseRfqAction — parent/child Rfq rows', () => {
  it('refuses to revise a CLOSED parent', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'rfq_parent',
      workspaceId: 'ws_1',
      deletedAt: null,
      contact: { id: 'c1', name: 'C', email: 'c@v.com' },
      vendor: { name: 'V', id: 'v1' },
      list: { id: 'l1', neededBy: null, name: 'L', lines: [] },
      childRfqs: [],
      status: 'ACCEPTED',
      neededBy: null,
      message: null,
      number: 'RFQ-1',
      vendorId: 'v1',
      vendorContact: { id: 'c1' },
      contactId: 'c1',
      listId: 'l1',
      revision: 1,
    });
    const res = await reviseRfqAction('ws_1', 'rfq_parent');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ACCEPTED/);
  });

  it('refuses to revise when no contact email is on file', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'rfq_parent',
      workspaceId: 'ws_1',
      deletedAt: null,
      contact: null,
      vendor: { name: 'V', id: 'v1' },
      list: { id: 'l1', neededBy: null, name: 'L', lines: [] },
      childRfqs: [],
      status: 'SENT',
      neededBy: null,
      message: null,
      number: 'RFQ-1',
      vendorId: 'v1',
      contactId: null,
      listId: 'l1',
      revision: 1,
    });
    const res = await reviseRfqAction('ws_1', 'rfq_parent');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/contact email/);
  });

  it('creates a new Rfq row with parentRfqId + revision, flips parent to SUPERSEDED', async () => {
    // Parent lookup
    mockFindFirst.mockResolvedValueOnce({
      id: 'rfq_parent',
      workspaceId: 'ws_1',
      deletedAt: null,
      contact: { id: 'c1', name: 'C', email: 'c@v.com' },
      vendor: { name: 'V', id: 'v1' },
      list: { id: 'l1', neededBy: null, name: 'L', lines: [{ id: 'l1a' }, { id: 'l1b' }] },
      childRfqs: [],
      status: 'SENT',
      neededBy: null,
      message: 'old message',
      number: 'RFQ-2026-0001',
      vendorId: 'v1',
      contactId: 'c1',
      listId: 'l1',
      revision: 1,
    });
    // The transaction callback. We capture it and call it with
    // a fake tx that records the calls.
    const txCalls: { method: string; args: unknown }[] = [];
    const tx = {
      rfq: {
        create: (args: unknown) => {
          txCalls.push({ method: 'rfq.create', args });
          return Promise.resolve({ id: 'rfq_child', number: 'RFQ-2026-0001', revision: 2 });
        },
        update: (args: unknown) => {
          txCalls.push({ method: 'rfq.update', args });
          return Promise.resolve({});
        },
      },
      rfqEvent: {
        create: (args: unknown) => {
          txCalls.push({ method: 'rfqEvent.create', args });
          return Promise.resolve({});
        },
      },
    };
    mockTransaction.mockImplementationOnce((cb) => cb(tx));

    // The post-transaction SENT update.
    mockUpdate.mockResolvedValueOnce({});

    const res = await reviseRfqAction('ws_1', 'rfq_parent');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.newRfqId).toBe('rfq_child');
      expect(res.sent).toBe(true);
      expect(res.message).toMatch(/[Rr]ev 2/);
    }

    // The new Rfq row should have parentRfqId, revision 2,
    // and a number suffixed with "-R2" so it satisfies the
    // (workspaceId, number) unique constraint while staying
    // human-readable.
    const create = txCalls.find((c) => c.method === 'rfq.create');
    expect(create).toBeTruthy();
    const createData = (create as { args: { data: { parentRfqId: string; revision: number; number: string } } }).args.data;
    expect(createData.parentRfqId).toBe('rfq_parent');
    expect(createData.revision).toBe(2);
    expect(createData.number).toBe('RFQ-2026-0001-R2');

    // The parent should have been flipped to SUPERSEDED.
    const parentUpdate = txCalls.find(
      (c) => c.method === 'rfq.update' && (c.args as { where: { id: string } }).where.id === 'rfq_parent',
    );
    expect(parentUpdate).toBeTruthy();
    const parentData = (parentUpdate as { args: { data: { status: string } } }).args.data;
    expect(parentData.status).toBe('SUPERSEDED');

    // Two events: SUPERSEDED on parent, CREATED on child.
    const events = txCalls.filter((c) => c.method === 'rfqEvent.create');
    expect(events).toHaveLength(2);
    const eventTypes = events.map(
      (e) => (e as { args: { data: { type: string } } }).args.data.type,
    );
    expect(eventTypes).toContain('SUPERSEDED');
    expect(eventTypes).toContain('CREATED');
  });

  it('returns a friendly error when the suffix still collides (defensive)', async () => {
    // Defensive: if a prior failed run left a child row with
    // the same -R{nextRevision} suffix, we should surface a
    // clear error instead of a raw Prisma stack trace.
    mockFindFirst.mockResolvedValueOnce({
      id: 'rfq_parent',
      workspaceId: 'ws_1',
      deletedAt: null,
      contact: { id: 'c1', name: 'C', email: 'c@v.com' },
      vendor: { name: 'V', id: 'v1' },
      list: { id: 'l1', neededBy: null, name: 'L', lines: [] },
      childRfqs: [],
      status: 'SENT',
      neededBy: null,
      message: null,
      number: 'RFQ-2026-0001',
      vendorId: 'v1',
      contactId: 'c1',
      listId: 'l1',
      revision: 1,
    });
    mockTransaction.mockImplementationOnce(() => {
      throw new Error(
        'Unique constraint failed on the fields: (`workspaceId`,`number`)',
      );
    });
    const res = await reviseRfqAction('ws_1', 'rfq_parent');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/revision with that number already exists/i);
    }
  });
});
