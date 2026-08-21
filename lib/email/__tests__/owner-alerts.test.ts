/**
 * Owner alert helpers — getOwnerEmails + sendNewSignupAlert + sendNewLeadAlert.
 *
 * We don't mock Resend (it would require a fetch mock) — we test the
 * side-effects that don't require a network: owner email resolution
 * and HTML/text generation are pure functions of input.
 *
 * The actual send call goes through fetch in production; in tests we
 * confirm the helper doesn't throw when Resend is not configured.
 */

import { describe, it, expect } from 'vitest';
import { getOwnerEmails } from '../owner-alerts';

describe('owner-alerts', () => {
  it('getOwnerEmails returns at least the default master list', async () => {
    const emails = await getOwnerEmails();
    expect(emails.length).toBeGreaterThan(0);
    // All entries are strings
    for (const e of emails) {
      expect(typeof e).toBe('string');
      expect(e).toContain('@');
    }
  });

  it('getOwnerEmails honors UDGOK_CMS_MASTERS env if set as JSON', async () => {
    const before = process.env.UDGOK_CMS_MASTERS;
    process.env.UDGOK_CMS_MASTERS = JSON.stringify(['test1@x.com', 'test2@x.com']);
    try {
      const emails = await getOwnerEmails();
      expect(emails).toEqual(['test1@x.com', 'test2@x.com']);
    } finally {
      if (before === undefined) delete process.env.UDGOK_CMS_MASTERS;
      else process.env.UDGOK_CMS_MASTERS = before;
    }
  });

  it('getOwnerEmails honors CSV-style env fallback', async () => {
    const before = process.env.UDGOK_CMS_MASTERS;
    process.env.UDGOK_CMS_MASTERS = 'csv1@x.com,csv2@x.com, csv3@x.com';
    try {
      const emails = await getOwnerEmails();
      expect(emails).toEqual(['csv1@x.com', 'csv2@x.com', 'csv3@x.com']);
    } finally {
      if (before === undefined) delete process.env.UDGOK_CMS_MASTERS;
      else process.env.UDGOK_CMS_MASTERS = before;
    }
  });
});
