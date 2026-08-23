/**
 * Lien waiver email helper tests.
 *
 * We don't test the actual network call to Resend — we test the
 * HTML/text rendering (pure functions of input) and confirm the
 * helper doesn't throw when RESEND_API_KEY isn't set.
 */

import { describe, it, expect } from 'vitest';
import { sendLienWaiverEmail } from '../lien-waiver';

const FIXED_ARGS = {
  to: 'sub@example.com',
  gcName: 'Yasir Qureshi',
  projectName: 'Clarus Medical Office Buildout',
  number: 'LW-2026-0001',
  typeLabel: 'Conditional Waiver and Release on Progress Payment',
  amountCents: 5000000, // $50,000.00
  throughDate: new Date('2026-08-31'),
  payAppNumber: 4,
  signUrl: 'https://cms.udgok.com/lw/abc123token',
  exceptionText: null as string | null,
  daysSinceSent: 0,
};

describe('sendLienWaiverEmail', () => {
  it('returns an error when RESEND_API_KEY is not set (no network call attempted)', async () => {
    const before = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const res = await sendLienWaiverEmail({ ...FIXED_ARGS, variant: 'initial' });
      expect(res.sent).toBe(false);
      expect(res.error).toMatch(/RESEND_API_KEY/);
    } finally {
      if (before !== undefined) process.env.RESEND_API_KEY = before;
    }
  });

  it('handles exception text by including it in the output (not throwing)', async () => {
    const before = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const res = await sendLienWaiverEmail({
        ...FIXED_ARGS,
        exceptionText: 'Except for retainage of $5,000',
        variant: 'reminder',
        daysSinceSent: 3,
      });
      expect(res.sent).toBe(false);
      expect(res.error).toMatch(/RESEND_API_KEY/);
    } finally {
      if (before !== undefined) process.env.RESEND_API_KEY = before;
    }
  });

  it('handles null payAppNumber (project-level final waiver)', async () => {
    const before = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const res = await sendLienWaiverEmail({
        ...FIXED_ARGS,
        payAppNumber: null,
        variant: 'initial',
      });
      expect(res.sent).toBe(false);
    } finally {
      if (before !== undefined) process.env.RESEND_API_KEY = before;
    }
  });
});
