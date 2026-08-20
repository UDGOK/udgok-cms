/**
 * Pure helpers for hours / week math. No DB calls.
 * Kept separate so the queries layer and the PDF
 * generator can share the same rules.
 *
 * Why a Decimal for hours: floats lose precision on
 * sum operations, and a weekly total of 47.5h being
 * 47.499999 is unacceptable for billing. We use
 * Prisma's Decimal type and operate on it as a number
 * (with 2-decimal rounding) in the UI.
 */

/**
 * Effective hours for a single check-in event.
 *   editedHours ?? (checkedOutAt - checkedInAt in hours)
 *
 * Returns null when the event is still open (no
 * checkedOutAt AND no editedHours) — caller decides
 * whether to show "open — pending" or skip.
 */
export function effectiveHours(event: {
  editedHours: { toString(): string } | number | null;
  checkedInAt: Date;
  checkedOutAt: Date | null;
}): number | null {
  if (event.editedHours !== null) {
    if (typeof event.editedHours === 'number') return event.editedHours;
    return parseFloat(event.editedHours.toString());
  }
  if (event.checkedOutAt === null) return null;
  const ms = event.checkedOutAt.getTime() - event.checkedInAt.getTime();
  // Round to 2 decimals. We don't floor — a check-in
  // at 7:02:30 and out at 4:59:30 should round to
  // 7.95h, not 7h.
  return Math.round((ms / 3_600_000) * 100) / 100;
}

/**
 * Sum hours for a list of events. Skips null
 * (open) events. Returns 0 for an empty list.
 */
export function sumHours(events: Array<Parameters<typeof effectiveHours>[0]>): number {
  let total = 0;
  for (const e of events) {
    const h = effectiveHours(e);
    if (h !== null) total += h;
  }
  return Math.round(total * 100) / 100;
}

// =====================================================================
// Week math
// =====================================================================

/**
 * Get the Monday 00:00:00 of the week containing `d`.
 * US construction convention: weeks run Mon–Sun. We
 * use the LOCAL timezone of the server, which is
 * UTC for Vercel. For a UDGOK user in Texas, a check-
 * in at 7am local on Mon maps to ~13:00 UTC, which
 * might be in the prior day in UTC. This is fine for
 * a daily-grid view (we just need the date to be
 * consistent) but flagged as a known limitation in
 * comments.
 */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  // Sunday = 0, Monday = 1, ..., Saturday = 6
  // We want Monday = 0 ... Sunday = 6 for the math
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day; // when day=0 (Sun), go back 6
  out.setDate(out.getDate() + diff);
  return out;
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const out = new Date(start);
  out.setDate(out.getDate() + 7); // exclusive end
  return out;
}

/**
 * Inclusive date labels for a week — Mon through Sun.
 * Returns the 7 Date objects for the start of each day.
 */
export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format a date label like "Mon" / "Tue" or "Mar 4"
 * depending on the granularity needed.
 */
export function dayLabel(d: Date, kind: 'short' | 'long' | 'date'): string {
  if (kind === 'short') {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  if (kind === 'date') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatHours(h: number | null): string {
  if (h === null) return '—';
  // 7.5 → "7.5h", 7 → "7h", 7.25 → "7.25h"
  if (h === Math.floor(h)) return `${h}h`;
  return `${h.toFixed(2).replace(/\.?0+$/, '')}h`;
}
