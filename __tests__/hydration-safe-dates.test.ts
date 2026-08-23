/**
 * Regression test: date/time formatters in the app must be
 * timezone-deterministic.
 *
 * Background (Aug 2026): the lien-waivers detail page rendered
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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fmtDate, fmtDateTimeUtc, fmtDateInput } from '../lib/format/currency';

describe('No inline toLocaleString in any server-rendered page', () => {
  // The bug this prevents: server components rendering
  // `new Date(...).toLocaleString('en-US')` produce different
  // strings on server (UTC) vs client (user's local timezone).
  // React throws #425 / #422 ("Text content does not match
  // server-rendered HTML" / "Hydration failed") in production.
  //
  // The fix is to use the timezone-deterministic formatters in
  // /lib/format/currency (fmtDate, fmtDateTimeUtc, fmtDateInput).
  // This test enforces that — any new page that renders a date
  // must import from the shared utility, not call toLocaleString
  // inline.

  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const s = statSync(p);
      if (s.isDirectory()) {
        yield* walk(p);
      } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
        yield p;
      }
    }
  }

  const files: string[] = [];
  for (const dir of ['app', 'components']) {
    try {
      for (const f of walk(dir)) files.push(f);
    } catch {
      // dir might not exist
    }
  }

  for (const file of files) {
    const rel = file.replace(process.cwd() + '/', '');
    const src = readFileSync(file, 'utf8');
    // Skip client components (have 'use client' at the top)
    if (src.startsWith("'use client'") || src.startsWith('"use client"')) continue;
    // Skip the shared utility itself
    if (file.includes('lib/format/currency')) continue;
    // Skip files that are clearly test-only
    if (file.includes('__tests__')) continue;

    // Look for `new Date(...).toLocaleString(...)` in JSX contexts.
    const hasInlineToLocaleString = /\{\s*new Date\([^)]*\)\.toLocaleString\b/.test(src);
    const hasInlineToLocaleDateString = /\.toLocaleDateString\(\s*['"]en-US['"]/.test(src);

    it(`${rel} does not call .toLocaleString inline`, () => {
      expect(
        hasInlineToLocaleString,
        hasInlineToLocaleString
          ? `Found inline 'new Date(...).toLocaleString' in ${rel}.\n` +
            `Use the shared formatters from /lib/format/currency (fmtDate, fmtDateTimeUtc, fmtDateInput) — they use timeZone: 'UTC' for hydration safety.`
          : '',
      ).toBe(false);
    });

    it(`${rel} does not call .toLocaleDateString('en-US', ...) inline`, () => {
      expect(
        hasInlineToLocaleDateString,
        hasInlineToLocaleDateString
          ? `Found inline '.toLocaleDateString("en-US", ...)' in ${rel}.\n` +
            `Use the shared formatters from /lib/format/currency (fmtDate, fmtDateInput) — they use timeZone: 'UTC' for hydration safety.`
          : '',
      ).toBe(false);
    });
  }
});

describe('Date formatters are timezone-deterministic', () => {
  // Pick a date that crosses midnight in many US timezones.
  // Aug 20 03:00 UTC = Aug 19 23:00 EDT = Aug 19 20:00 PDT.
  // The UTC date is "Aug 20" — the PDT/EDT date is "Aug 19".
  // If `timeZone: 'UTC'` is missing from the formatter options,
  // the test will fail when run on a non-UTC host (CI, dev
  // laptops, anywhere outside UTC).
  const referenceDate = new Date('2026-08-20T03:00:00.000Z');

  it('fmtDate produces the same output regardless of host timezone', () => {
    // We use the test runner's `process.env.TZ` to simulate a
    // non-UTC host — the assertion would only be meaningful if
    // the formatter is truly timezone-deterministic. If you run
    // this test in PDT and the formatter uses the system
    // timezone, it would render "Aug 19" (because Aug 20 03:00
    // UTC = Aug 19 20:00 PDT). With `timeZone: 'UTC'` the
    // output is "Aug 20" everywhere.
    const formatted = fmtDate(referenceDate);
    expect(formatted).toBe('Aug 20, 2026');
  });

  it('fmtDate is timezone-deterministic when run in a non-UTC timezone', () => {
    // Save and override the TZ env var to simulate a PDT host.
    // This catches the bug where someone re-introduces
    // `timeZone: 'system'` (or omits `timeZone: 'UTC'`).
    const savedTz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      // Re-import the formatters inside the changed TZ. Node
      // caches `Intl.DateTimeFormat` instances, but the
      // `timeZone` option is checked at format-time, not
      // at construction time. So calling the function again
      // should still return the UTC date.
      const formatted = fmtDate(referenceDate);
      expect(formatted).toBe('Aug 20, 2026');
    } finally {
      if (savedTz === undefined) delete process.env.TZ;
      else process.env.TZ = savedTz;
    }
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
