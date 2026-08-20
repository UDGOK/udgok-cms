// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Hours / week math — pure helper tests. No DB
 * calls. We test the rules that the queries, the
 * PDF generator, and the UI all depend on.
 */

import {
  effectiveHours,
  endOfWeek,
  formatHours,
  isSameLocalDay,
  startOfWeek,
  sumHours,
  weekDays,
} from '../hours';

describe('effectiveHours', () => {
  it('uses editedHours when set (number)', () => {
    expect(
      effectiveHours({
        editedHours: 6.5,
        checkedInAt: new Date('2026-08-19T07:00:00Z'),
        checkedOutAt: new Date('2026-08-19T16:00:00Z'), // would compute 9
      }),
    ).toBe(6.5);
  });

  it('uses editedHours when set (Decimal-ish toString)', () => {
    expect(
      effectiveHours({
        editedHours: { toString: () => '7.25' },
        checkedInAt: new Date('2026-08-19T07:00:00Z'),
        checkedOutAt: new Date('2026-08-19T15:00:00Z'),
      }),
    ).toBe(7.25);
  });

  it('computes hours from checkedOutAt - checkedInAt when no override', () => {
    expect(
      effectiveHours({
        editedHours: null,
        checkedInAt: new Date('2026-08-19T07:00:00Z'),
        checkedOutAt: new Date('2026-08-19T15:30:00Z'),
      }),
    ).toBe(8.5);
  });

  it('returns null when open and no override', () => {
    expect(
      effectiveHours({
        editedHours: null,
        checkedInAt: new Date('2026-08-19T07:00:00Z'),
        checkedOutAt: null,
      }),
    ).toBeNull();
  });

  it('rounds to 2 decimals (not floored)', () => {
    // 7:02:30 to 15:00:00 = 7h 57m 30s = 7.9583...h
    expect(
      effectiveHours({
        editedHours: null,
        checkedInAt: new Date('2026-08-19T07:02:30Z'),
        checkedOutAt: new Date('2026-08-19T15:00:00Z'),
      }),
    ).toBe(7.96);
  });
});

describe('sumHours', () => {
  it('sums a list and skips nulls', () => {
    const result = sumHours([
      {
        editedHours: null,
        checkedInAt: new Date('2026-08-19T07:00:00Z'),
        checkedOutAt: new Date('2026-08-19T15:00:00Z'), // 8
      },
      {
        editedHours: null,
        checkedInAt: new Date('2026-08-19T07:00:00Z'),
        checkedOutAt: null, // open — skipped
      },
      {
        editedHours: 4,
        checkedInAt: new Date('2026-08-19T07:00:00Z'),
        checkedOutAt: new Date('2026-08-19T17:00:00Z'),
      },
    ]);
    expect(result).toBe(12);
  });

  it('returns 0 for empty list', () => {
    expect(sumHours([])).toBe(0);
  });
});

describe('startOfWeek', () => {
  it('returns Monday 00:00 for a Wednesday', () => {
    // 2026-08-19 is a Wednesday
    const d = new Date(2026, 7, 19, 14, 30, 0); // Wed Aug 19 2026 14:30
    const out = startOfWeek(d);
    expect(out.getDay()).toBe(1); // Monday
    expect(out.getDate()).toBe(17); // Aug 17
    expect(out.getHours()).toBe(0);
    expect(out.getMinutes()).toBe(0);
  });

  it('returns the same day for a Monday', () => {
    // Aug 17 2026 is a Monday
    const d = new Date(2026, 7, 17, 9, 0, 0);
    const out = startOfWeek(d);
    expect(out.getDate()).toBe(17);
  });

  it('goes back 6 days for a Sunday', () => {
    // Aug 23 2026 is a Sunday
    const d = new Date(2026, 7, 23, 12, 0, 0);
    const out = startOfWeek(d);
    expect(out.getDay()).toBe(1); // Monday
    expect(out.getDate()).toBe(17); // Aug 17
  });
});

describe('endOfWeek', () => {
  it('is exclusive end (next Monday 00:00)', () => {
    const d = new Date(2026, 7, 19);
    const end = endOfWeek(d);
    expect(end.getDay()).toBe(1);
    expect(end.getDate()).toBe(24); // next Monday
  });
});

describe('weekDays', () => {
  it('returns 7 days starting from Monday', () => {
    const d = new Date(2026, 7, 19); // Wednesday
    const days = weekDays(d);
    expect(days.length).toBe(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0); // Sunday
    expect(days[0].getDate()).toBe(17);
    expect(days[6].getDate()).toBe(23);
  });
});

describe('isSameLocalDay', () => {
  it('matches same-day dates', () => {
    expect(
      isSameLocalDay(
        new Date(2026, 7, 19, 7, 0),
        new Date(2026, 7, 19, 23, 59),
      ),
    ).toBe(true);
  });

  it('does not match different days', () => {
    expect(
      isSameLocalDay(
        new Date(2026, 7, 19, 23, 59),
        new Date(2026, 7, 20, 0, 0),
      ),
    ).toBe(false);
  });
});

describe('formatHours', () => {
  it('formats whole hours as "Nh"', () => {
    expect(formatHours(8)).toBe('8h');
    expect(formatHours(0)).toBe('0h');
  });

  it('strips trailing zeros for half / quarter hours', () => {
    expect(formatHours(7.5)).toBe('7.5h');
    expect(formatHours(7.25)).toBe('7.25h');
  });

  it('returns "—" for null', () => {
    expect(formatHours(null)).toBe('—');
  });
});
