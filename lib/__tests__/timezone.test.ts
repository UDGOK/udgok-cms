// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Timezone helper tests. We don't test against
 * specific outputs (timezones have DST) — we
 * test the SHAPE: dates in different timezones
 * produce different strings, and the user's tz
 * is honored when set.
 */

import {
  formatInUserTz,
  formatShort,
  formatDay,
  formatDate,
  userTimezone,
  COMMON_TIMEZONES,
} from '../timezone';

describe('userTimezone', () => {
  it('returns the user timezone when set', () => {
    expect(userTimezone({ timezone: 'America/Chicago' })).toBe('America/Chicago');
  });

  it('falls back to UTC when null', () => {
    expect(userTimezone(null)).toBe('UTC');
    expect(userTimezone({ timezone: null })).toBe('UTC');
  });

  it('falls back to UTC when the object is empty', () => {
    expect(userTimezone({})).toBe('UTC');
  });
});

describe('formatInUserTz', () => {
  // A fixed UTC moment: 2026-03-04T14:00:00Z.
  // In America/Chicago (CST = UTC-6 in March, before
  // DST starts) that's 8:00 AM.
  // In America/Los_Angeles (PST = UTC-8) that's 6:00 AM.
  const utc = new Date('2026-03-04T14:00:00Z');

  it('renders the same instant in different timezones', () => {
    const chicago = formatInUserTz(utc, { timezone: 'America/Chicago' }, {
      hour: 'numeric',
      minute: '2-digit',
    });
    const la = formatInUserTz(utc, { timezone: 'America/Los_Angeles' }, {
      hour: 'numeric',
      minute: '2-digit',
    });
    expect(chicago).not.toBe(la);
    // 14:00 UTC → 8 AM Chicago, 6 AM LA.
    expect(chicago).toMatch(/8/);
    expect(la).toMatch(/6/);
  });

  it('honors the user timezone when set', () => {
    const result = formatInUserTz(utc, { timezone: 'America/Chicago' }, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    // March 4 in Chicago (the same instant as
    // March 4 14:00 UTC, which is March 4 8 AM
    // Chicago — so the date doesn't cross midnight
    // in March).
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/4/);
    expect(result).toMatch(/2026/);
  });

  it('accepts ISO strings', () => {
    const result = formatInUserTz('2026-03-04T14:00:00Z', { timezone: 'UTC' }, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/4/);
  });
});

describe('formatShort / formatDay / formatDate', () => {
  const utc = new Date('2026-03-04T14:00:00Z');

  it('formatShort renders month + day + time', () => {
    const result = formatShort(utc, { timezone: 'UTC' });
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/4/);
  });

  it('formatDay renders the weekday', () => {
    const result = formatDay(utc, { timezone: 'UTC' });
    // 2026-03-04 is a Wednesday
    expect(result).toMatch(/Wed/);
  });

  it('formatDate renders month + day', () => {
    const result = formatDate(utc, { timezone: 'UTC' });
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/4/);
  });
});

describe('COMMON_TIMEZONES', () => {
  it('includes America/Chicago (the user\u2019s tz)', () => {
    expect(COMMON_TIMEZONES.some((tz) => tz.value === 'America/Chicago')).toBe(true);
  });

  it('includes UTC as a fallback', () => {
    expect(COMMON_TIMEZONES.some((tz) => tz.value === 'UTC')).toBe(true);
  });

  it('every entry has a value + label', () => {
    for (const tz of COMMON_TIMEZONES) {
      expect(tz.value).toBeTruthy();
      expect(tz.label).toBeTruthy();
    }
  });
});
