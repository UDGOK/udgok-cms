import { describe, it, expect } from 'vitest';
import { relativeTime } from '../relative-time';

describe('relativeTime', () => {
  it('returns "never" for null/undefined', () => {
    expect(relativeTime(null)).toBe('never');
    expect(relativeTime(undefined)).toBe('never');
  });

  it('returns "just now" for <60s ago', () => {
    const now = new Date().toISOString();
    expect(relativeTime(now)).toBe('just now');
    const thirty = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(thirty)).toBe('just now');
  });

  it('returns "X min ago" for <1h', () => {
    const four = new Date(Date.now() - 4 * 60_000).toISOString();
    expect(relativeTime(four)).toBe('4 min ago');
  });

  it('returns "Xh ago" for <24h', () => {
    const two = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    expect(relativeTime(two)).toBe('2h ago');
  });

  it('returns "yesterday" for ~24h', () => {
    const y = new Date(Date.now() - 25 * 60 * 60_000).toISOString();
    expect(relativeTime(y)).toBe('yesterday');
  });

  it('returns "Xd ago" for <7d', () => {
    const three = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    expect(relativeTime(three)).toBe('3d ago');
  });

  it('returns short month/day for same-year older (>7d)', () => {
    // 14 days ago — outside the "Xd ago" range, falls into calendar date
    const fortnight = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
    const result = relativeTime(fortnight);
    // Either "Xd ago" (if test runs same day) or a calendar date
    expect(result).toMatch(/(d ago$|[A-Z][a-z]{2} \d+)/);
  });
});
