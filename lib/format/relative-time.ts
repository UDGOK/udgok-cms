/**
 * Format a date as a human-friendly "last seen" string.
 *   now → "just now"
 *   4 min ago → "4 min ago"
 *   2 hours ago → "2h ago"
 *   yesterday → "yesterday"
 *   3 days ago → "3d ago"
 *   2 weeks ago → "Aug 2"
 *   >6 months → "Apr 2025"
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const now = Date.now();
  const diff = now - then;
  if (diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  if (diff < 2 * 24 * 60 * 60_000) return 'yesterday';
  if (diff < 7 * 24 * 60 * 60_000) return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;

  // Older — show a calendar date
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', year: 'numeric' });
}
