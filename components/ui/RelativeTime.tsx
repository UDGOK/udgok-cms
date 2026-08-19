'use client';

import { useEffect, useState } from 'react';

interface RelativeTimeProps {
  /** ISO 8601 timestamp string. */
  iso: string | null | undefined;
  /**
   * What to render before client hydration completes. We use the
   * absolute date so server and first client render produce the
   * IDENTICAL HTML — this is what kills the React #425/#422
   * hydration mismatch (server says "Aug 15" with a stable locale,
   * client hydrates with the same string, then useEffect swaps
   * to the relative form on the next tick).
   */
  fallback?: string;
  className?: string;
  /** HTML title attribute — always shows the absolute date for accessibility. */
  title?: string;
}

/**
 * Format a date as a human-friendly "last seen" string.
 *   now → "just now"
 *   4 min ago → "4 min ago"
 *   2 hours ago → "2h ago"
 *   yesterday → "yesterday"
 *   3 days ago → "3d ago"
 *   2 weeks ago → "Aug 2"
 *   >6 months → "Apr 2025"
 *
 * This is a pure function — exported separately so it can be used
 * inside the component (which only runs on the client).
 */
export function formatRelative(iso: string): string {
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

/**
 * Format a date as a stable absolute string for the SSR fallback
 * (server and client must produce IDENTICAL bytes). Uses a fixed
 * locale so the format is the same on every machine.
 */
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'never';
  // en-US is deterministic across machines. We avoid toLocaleString
  // without an explicit locale because the server's default locale
  // and the client's default locale can differ.
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const now = new Date();
  const sameYear = now.getUTCFullYear() === year;
  return sameYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
}

/**
 * Drop-in replacement for inline calls to the old `relativeTime()`
 * helper. Renders an absolute date on the server (no hydration
 * mismatch) and swaps to a relative time on the client. The
 * absolute date is always available as the `title` attribute for
 * accessibility / hover.
 */
export function RelativeTime({ iso, fallback, className, title }: RelativeTimeProps) {
  // We default to the absolute string so the first paint matches
  // the server-rendered HTML. useEffect then upgrades to the
  // relative form on the client.
  const initial = iso ? (fallback ?? formatAbsolute(iso)) : 'never';
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (!iso) {
      setText('never');
      return;
    }
    setText(formatRelative(iso));
    // Re-render every 30s so the "5 min ago" actually updates
    // while the user has the page open.
    const id = window.setInterval(() => setText(formatRelative(iso)), 30_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return (
    <span className={className} title={title ?? (iso ? new Date(iso).toISOString() : undefined)}>
      {text}
    </span>
  );
}
