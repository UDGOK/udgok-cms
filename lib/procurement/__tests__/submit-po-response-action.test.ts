/**
 * submitPoResponseAction — the public intake action called
 * by the vendor portal. No Clerk session — the token in
 * the form data IS the credential.
 *
 * Tests:
 *   - role/scope: not a real role check (no auth) but the
 *     token must hash-match a PO
 *   - validation: name + email required, payment method enum
 *   - state machine: CANCELLED + non-ISSUED/ACKNOWLEDGED POs
 *     reject submission
 *   - success: writes PoVendorResponse + PoVendorResponseLine
 *     + PoEvent, updates the PO with response fields
 *   - ACCEPTED: sets acknowledgedAt
 *   - REJECTED: status → CANCELLED
 *   - COUNTERED: status stays ISSUED
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPoFindFirst = vi.fn();
const mockResponseCreate = vi.fn();
const mockPoUpdate = vi.fn();
const mockEventCreate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRateLimit = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    purchaseOrder: {
      findFirst: (...args: unknown[]) => mockPoFindFirst(...args),
      update: (...args: unknown[]) => mockPoUpdate(...args),
    },
    poVendorResponse: {
      create: (...args: unknown[]) => mockResponseCreate(...args),
    },
    poEvent: {
      create: (...args: unknown[]) => mockEventCreate(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      poVendorResponse: { create: (...args: unknown[]) => mockResponseCreate(...args) },
      purchaseOrder: { update: (...args: unknown[]) => mockPoUpdate(...args) },
      poEvent: { create: (...args: unknown[]) => mockEventCreate(...args) },
    }),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('next/headers', () => ({
  headers: () => ({ get: (k: string) => (k === 'x-forwarded-for' ? '1.2.3.4' : null) }),
}));

vi.mock('@/lib/procurement/rateLimit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

import { submitPoResponseAction } from '../po-vendor-intake';

beforeEach(() => {
  mockPoFindFirst.mockReset();
  mockResponseCreate.mockReset();
  mockPoUpdate.mockReset();
  mockEventCreate.mockReset();
  mockRevalidatePath.mockReset();
  mockRateLimit.mockReset();
  mockRateLimit.mockResolvedValue({ ok: true });
  mockPoFindFirst.mockResolvedValue({
    id: 'po_1',
    workspaceId: 'ws_1',
    number: 'PO-2026-0001',
    status: 'ISSUED',
  });
  mockResponseCreate.mockResolvedValue({ id: 'resp_1' });
  mockPoUpdate.mockResolvedValue({});
  mockEventCreate.mockResolvedValue({});
});

const SAMPLE = {
  token: 'a'.repeat(43),
  responseType: 'ACCEPTED' as const,
  paymentMethod: 'INVOICE_BY_EMAIL' as const,
  signedByName: 'Sara Smith',
  signedByEmail: 'sara@locke.com',
  lines: [
    {
      poLineId: 'line_1',
      isConfirmed: true,
      confirmedQty: 4,
      confirmedPrice: 25,
    },
  ],
};

describe('submitPoResponseAction', () => {
  it('rejects when the PO does not exist', async () => {
    mockPoFindFirst.mockResolvedValueOnce(null);
    const res = await submitPoResponseAction(SAMPLE);
    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toMatch(/no longer valid/);
  });

  it('rejects when PO is CANCELLED', async () => {
    mockPoFindFirst.mockResolvedValueOnce({ id: 'p', workspaceId: 'w', number: 'x', status: 'CANCELLED' });
    const res = await submitPoResponseAction(SAMPLE);
    expect(res.ok).toBe(false);
  });

  it('rejects when PO is in DRAFT (not yet issued)', async () => {
    mockPoFindFirst.mockResolvedValueOnce({ id: 'p', workspaceId: 'w', number: 'x', status: 'DRAFT' });
    const res = await submitPoResponseAction(SAMPLE);
    expect(res.ok).toBe(false);
  });

  it('rejects when signedByName is empty', async () => {
    const res = await submitPoResponseAction({ ...SAMPLE, signedByName: '' });
    expect(res.ok).toBe(false);
    expect((res as { fieldErrors: Record<string, string> }).fieldErrors.signedByName).toBeTruthy();
  });

  it('rejects when signedByEmail is invalid', async () => {
    const res = await submitPoResponseAction({ ...SAMPLE, signedByEmail: 'not-an-email' });
    expect(res.ok).toBe(false);
    expect((res as { fieldErrors: Record<string, string> }).fieldErrors.signedByEmail).toBeTruthy();
  });

  it('writes response + event + updates PO on ACCEPTED', async () => {
    const res = await submitPoResponseAction(SAMPLE);
    expect(res.ok).toBe(true);
    expect(mockResponseCreate).toHaveBeenCalledTimes(1);
    expect(mockPoUpdate).toHaveBeenCalledTimes(1);
    expect(mockEventCreate).toHaveBeenCalledTimes(1);
    const updateArg = mockPoUpdate.mock.calls[0]?.[0] as { data: { acknowledgedAt: Date } };
    expect(updateArg.data.acknowledgedAt).toBeInstanceOf(Date);
  });

  it('sets status to CANCELLED on REJECTED', async () => {
    const res = await submitPoResponseAction({ ...SAMPLE, responseType: 'REJECTED' });
    expect(res.ok).toBe(true);
    const updateArg = mockPoUpdate.mock.calls[0]?.[0] as { data: { status: string } };
    expect(updateArg.data.status).toBe('CANCELLED');
  });

  it('leaves status alone on COUNTERED', async () => {
    const res = await submitPoResponseAction({ ...SAMPLE, responseType: 'COUNTERED' });
    expect(res.ok).toBe(true);
    const updateArg = mockPoUpdate.mock.calls[0]?.[0] as { data: { status?: string } };
    expect(updateArg.data.status).toBeUndefined();
  });

  it('rate-limit denies when too many requests', async () => {
    mockRateLimit.mockResolvedValueOnce({ ok: false });
    const res = await submitPoResponseAction(SAMPLE);
    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toMatch(/Too many/);
  });
});
