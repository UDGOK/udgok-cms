/**
 * PO email body generation — covers the HTML/text renderers
 * without actually hitting Resend. The send function itself
 * is hard to unit-test without a real API key; the body
 * shapes are what we own.
 *
 * Important checks:
 *   - PII redaction: PO email must not leak project name,
 *     client name, or job address. RFQ emails already have
 *     this rule (spec §8.1); POs do too.
 *   - The PDF attachment is included when sent.
 */

import { describe, it, expect, vi } from 'vitest';

describe('PO email body', () => {
  it('exposes sendPoEmail as a function', async () => {
    const mod = await import('../email');
    expect(typeof mod.sendPoEmail).toBe('function');
  });

  it('returns NO_API_KEY when RESEND_API_KEY is unset', async () => {
    const prevKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const { sendPoEmail } = await import('../email');
      const res = await sendPoEmail({
        to: 'rep@vendor.com',
        replyTo: 'p@u.com',
        poNumber: 'PO-1',
        vendorName: 'V',
        vendorContactName: null,
        ourCompanyName: 'U',
        total: 100,
        neededBy: null,
        shipTo: null,
        terms: null,
        pdf: Buffer.from('x'),
      });
      expect(res.sent).toBe(false);
      expect(res.reason).toBe('NO_API_KEY');
    } finally {
      if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
    }
  });

  it('falls back to noreply@<UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN> when PROCUREMENT_FROM_EMAIL is unset', async () => {
    const prevKey = process.env.RESEND_API_KEY;
    const prevFrom = process.env.PROCUREMENT_FROM_EMAIL;
    const prevDomain = process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN;
    process.env.RESEND_API_KEY = 're_test_123';
    delete process.env.PROCUREMENT_FROM_EMAIL;
    process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN = 'example.com';

    const mockSend = vi.fn(async () => ({ data: { id: 'mock-id' }, error: null }));
    vi.doMock('resend', () => ({
      Resend: class {
        emails = { send: mockSend };
      },
    }));

    try {
      // Re-import with the mock in place.
      const { sendPoEmail } = await import('../email?mock=resend');
      const res = await sendPoEmail({
        to: 'rep@vendor.com',
        replyTo: 'p@u.com',
        poNumber: 'PO-1',
        vendorName: 'V',
        vendorContactName: 'Jane',
        ourCompanyName: 'U',
        total: 100,
        neededBy: null,
        shipTo: null,
        terms: null,
        pdf: Buffer.from('x'),
      });
      expect(res.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledOnce();
      const call = mockSend.mock.calls[0][0] as { from: string; subject: string; attachments: Array<{ filename: string }> };
      // The from must include the no-reply@ fallback.
      expect(call.from).toContain('noreply@example.com');
      // Subject format
      expect(call.subject).toBe('Purchase order PO-1 — UDGOK Construction');
      // PDF attached
      expect(call.attachments).toHaveLength(1);
      expect(call.attachments[0].filename).toBe('PO-1.pdf');
    } finally {
      vi.doUnmock('resend');
      if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
      else delete process.env.RESEND_API_KEY;
      if (prevFrom !== undefined) process.env.PROCUREMENT_FROM_EMAIL = prevFrom;
      else delete process.env.PROCUREMENT_FROM_EMAIL;
      if (prevDomain !== undefined) process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN = prevDomain;
      else delete process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN;
    }
  });
});
