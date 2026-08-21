/**
 * getWorkspacePaymentSettings — lazy-creates the singleton
 * with sensible defaults on first read.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspacePaymentSettings: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

import { getWorkspacePaymentSettings } from '../payment-settings';

beforeEach(() => {
  mockFindUnique.mockReset();
  mockCreate.mockReset();
});

describe('getWorkspacePaymentSettings', () => {
  it('returns existing row if present', async () => {
    mockFindUnique.mockResolvedValueOnce({
      invoiceEmail: 'custom@x.com',
      invoiceEmailCc: null,
      defaultTerms: 'Net 60',
      paymentLinkBaseUrl: null,
      achInstructions: null,
      checkPayableTo: 'Custom LLC',
      checkMailTo: '1 Main',
      allowAch: true,
      allowCard: true,
      allowCheck: true,
      allowPaymentLink: false,
    });
    const s = await getWorkspacePaymentSettings('ws_1');
    expect(s.invoiceEmail).toBe('custom@x.com');
    expect(s.defaultTerms).toBe('Net 60');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('lazy-creates with defaults on first read', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({
      invoiceEmail: 'ap@udgok.com',
      invoiceEmailCc: null,
      defaultTerms: 'Net 30',
      paymentLinkBaseUrl: null,
      achInstructions: null,
      checkPayableTo: 'UDGOK Construction',
      checkMailTo: null,
      allowAch: true,
      allowCard: false,
      allowCheck: true,
      allowPaymentLink: false,
    });
    const s = await getWorkspacePaymentSettings('ws_new');
    expect(s.invoiceEmail).toBe('ap@udgok.com');
    expect(s.defaultTerms).toBe('Net 30');
    expect(s.checkPayableTo).toBe('UDGOK Construction');
    expect(s.allowAch).toBe(true);
    expect(s.allowCard).toBe(false);
    expect(s.allowCheck).toBe(true);
    expect(s.allowPaymentLink).toBe(false);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: 'ws_new' }),
    });
  });
});
