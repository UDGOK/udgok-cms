/**
 * Timezone utilities.
 *
 * The app's date displays use Intl.DateTimeFormat with
 * a per-user IANA timezone. The IANA string lives on
 * the User row (User.timezone). When null, we fall
 * back to the server timezone (UTC for Vercel).
 *
 * Why a per-user timezone (and not "America/Chicago"
 * hardcoded for the UDGOK workspace): the user is
 * in Texas now, but the office might hire someone
 * in California, and admins sometimes travel. Per-
 * user is the right scope.
 *
 * The browser's Intl.DateTimeFormat does the work —
 * no date library needed.
 */

export const COMMON_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain Standard (Phoenix, no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Berlin', label: 'Berlin / Paris / Madrid' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India Standard (Kolkata)' },
  { value: 'Asia/Shanghai', label: 'China Standard (Shanghai)' },
  { value: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

/**
 * Returns the IANA timezone string to use for the
 * given user. Falls back to the server timezone
 * when the user hasn't set one.
 */
export function userTimezone(user: { timezone?: string | null } | null | undefined): string {
  return user?.timezone ?? 'UTC';
}

/**
 * Format a date in the user's timezone using
 * Intl.DateTimeFormat. Options follow the
 * standard Intl shape:
 *   dateStyle: 'short' | 'medium' | 'long' | 'full'
 *   timeStyle: ...
 *   Or use granular: year/month/day/hour/minute/second
 */
export function formatInUserTz(
  date: Date | string | number,
  user: { timezone?: string | null } | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
): string {
  const tz = userTimezone(user);
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: tz }).format(d);
}

/**
 * Short label: "Mar 4, 2:14 PM"
 */
export function formatShort(
  date: Date | string | number,
  user: { timezone?: string | null } | null | undefined,
): string {
  return formatInUserTz(date, user, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Day-of-week label: "Mon", "Tue", ...
 */
export function formatDay(
  date: Date | string | number,
  user: { timezone?: string | null } | null | undefined,
): string {
  return formatInUserTz(date, user, { weekday: 'short' });
}

/**
 * Date label: "Mar 4"
 */
export function formatDate(
  date: Date | string | number,
  user: { timezone?: string | null } | null | undefined,
): string {
  return formatInUserTz(date, user, { month: 'short', day: 'numeric' });
}

/**
 * Full timestamp: "Mon, Mar 4, 2026 · 2:14 PM"
 */
export function formatLong(
  date: Date | string | number,
  user: { timezone?: string | null } | null | undefined,
): string {
  return formatInUserTz(date, user, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
