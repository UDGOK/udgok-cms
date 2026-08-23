/**
 * Regression test: date/time formatters in the app must be
 * timezone-deterministic.
 *
 * Background (Aug 2026): the lien-waivers detail page rendered
 * `new Date(...).toLocaleString('en-US')` and used the default
 * `Intl.DateTimeFormat` for `fmtDate()`. The server (UTC) and
 * the client (user's local timezone) produced different strings
 * for the same Date, so React threw errors #425 and #422
 * ("Text content does not match server-rendered HTML" /
 * "Hydration failed"). The user saw a broken page.
 *
 * This test asserts the canonical formatters from
 * `/lib/format/currency` are timezone-deterministic. If
 * someone re-introduces a `toLocaleString` without an
 * explicit timezone, this test doesn't catch that directly,
 * but the formatter test below ensures the shared utility
 * is safe — pages should use the shared utility, not raw
 * `toLocaleString`.
 */

import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateTimeUtc, fmtDateInput } from '../lib/format/currency';

describe('Date formatters are timezone-deterministic', () => {
  // Pick a date that crosses midnight in many US timezones
  // (Aug 19, 2026, 23:30 UTC = Aug 19 19:30 EDT / Aug 19
  // 16:30 PDT). The UTC date is Aug 19 in all US timezones,
  // but if we used a date near midnight UTC (e.g. Aug 20
  // 03:00 UTC), the date would flip in some timezones.
  const referenceDate = new Date('2026-08-20T03:00:00.000Z');

  it('fmtDate produces the same output regardless of host timezone', () => {
    // We can't actually change the host timezone in this
    // test, but we can assert the output uses the UTC date
    // components — which is what makes it deterministic.
    // If `timeZone: 'UTC'` is removed, the output would
    // include the local date components and this assertion
    // would fail on non-UTC hosts.
    const formatted = fmtDate(referenceDate);
    expect(formatted).toBe('Aug 20, 2026');
    // The expected string above is the UTC date. If the
    // formatter used local time on a PDT host, the output
    // would be 'Aug 19, 2026'. That difference is the
    // hydration bug.
  });

  it('fmtDateTimeUtc appends UTC suffix for clarity', () => {
    const formatted = fmtDateTimeUtc(referenceDate);
    expect(formatted).toMatch(/UTC$/);
    expect(formatted).toContain('Aug 20, 2026');
  });

  it('fmtDateInput returns YYYY-MM-DD in UTC', () => {
    expect(fmtDateInput(referenceDate)).toBe('2026-08-20');
  });

  it('handles null/undefined with em-dash placeholder', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
    expect(fmtDateTimeUtc(null)).toBe('—');
  });

  it('handles ISO string input', () => {
    expect(fmtDate('2026-08-20T03:00:00.000Z')).toBe('Aug 20, 2026');
    expect(fmtDateInput('2026-08-20T03:00:00.000Z')).toBe('2026-08-20');
  });
});
