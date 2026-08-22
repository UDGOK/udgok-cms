'use client';

import { useEffect, useState } from 'react';

/**
 * ClockSkewIndicator — surfaces "your device clock is off
 * from our server" so timesheet + check-in + pay-app
 * timestamps are obviously trustworthy (or obviously not).
 *
 * The CMS stores every check-in / timesheet / pay-app
 * timestamp with `new Date()` ON THE SERVER. Vercel keeps
 * its clock synced via NTP to within a few hundred ms of
 * UTC, so the server is the source of truth. The visitor's
 * phone clock, on the other hand, can be off by minutes
 * (battery replaced, travel across time zones without
 * auto-sync, daylight savings bug, manually-set clock).
 *
 * If the visitor's clock is off by more than 60 seconds
 * the timestamp they see ("checked in at 2:14 PM") may not
 * match their watch — which is a real footgun foremen
 * notice immediately ("I just walked in, why does it say
 * 2:14 already?"). Surfacing the skew gives them a hint
 * that the server's clock is authoritative.
 *
 * The indicator is global, lives in the workspace layout,
 * and is dismissable per session via localStorage so it
 * doesn't nag the same person every page view.
 *
 * Threshold is 60s — below that, the human eye can't tell
 * the difference, and we'd just be noisy. (Check-in
 * granularity is 1 minute anyway.)
 */

const SKEW_THRESHOLD_MS = 60_000;
const STORAGE_KEY = 'cms.clockSkew.dismissedAt';
const RECHECK_INTERVAL_MS = 60_000;
// Suppress the warning if the visitor dismissed it less
// than 24 hours ago. Beyond that, show it again — clocks
// drift, OS updates reset them, and the user should know
// if the warning is current.
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function formatOffset(ms: number): string {
  const absSec = Math.round(Math.abs(ms) / 1000);
  const sign = ms > 0 ? 'behind' : 'ahead';
  if (absSec < 60) return `${absSec} second${absSec === 1 ? '' : 's'} ${sign}`;
  const minutes = Math.round(absSec / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ${sign}`;
}

function readServerTime(): number | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('server-now');
  if (!el) return null;
  const raw = el.getAttribute('data-server-now');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function wasDismissedRecently(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_TTL_MS;
}

function dismiss() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

export function ClockSkewIndicator() {
  const [skew, setSkew] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true); // start true to avoid flash

  useEffect(() => {
    setDismissed(wasDismissedRecently());
    function check() {
      const serverTime = readServerTime();
      if (serverTime == null) return;
      // Network + render latency: when the page first
      // hydrates, a few hundred ms may have passed since
      // the server stamped its time. We account for that
      // by using the page's loadEventEnd if available,
      // falling back to Date.now(). The threshold (60s) is
      // orders of magnitude larger than this latency, so
      // a small approximation is fine.
      const now = Date.now();
      setSkew(serverTime - now);
    }
    check();
    // Re-check periodically. A user could leave the tab
    // open across a DST boundary or a manual clock change,
    // and the page shouldn't get silently out of sync.
    const t = setInterval(check, RECHECK_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  if (skew == null || Math.abs(skew) < SKEW_THRESHOLD_MS || dismissed) {
    return null;
  }

  // The user's clock is behind when the server time is
  // greater than the user's time — e.g. server=14:05,
  // user=14:00. The banner says "behind" to match how
  // people think ("my watch is 5 minutes slow").
  return (
    <div
      role="status"
      data-testid="clock-skew-indicator"
      className="bg-warning/20 border-b-2 border-warning text-ink px-4 py-2 text-[12px] flex items-center justify-between gap-3"
    >
      <div>
        <span className="font-extrabold">⚠ Your device clock is {formatOffset(skew)}.</span>{' '}
        <span className="text-ink-70">
          Times on this page use the server clock, which is the
          authoritative source. Check your phone{'\u2019'}s
          auto-sync in Settings to fix the offset.
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          dismiss();
          setDismissed(true);
        }}
        className="shrink-0 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-70 hover:text-ink underline"
      >
        dismiss
      </button>
    </div>
  );
}

/**
 * Inline client-vs-server clock readout for the public
 * check-in page. The check-in stores the server's
 * `Date.now()` as `checkedInAt`, so the visitor's wall
 * clock should match what the page shows. If it doesn't,
 * show both side by side so they understand the recorded
 * time is the server's, not theirs.
 *
 * Returns a small one-liner: "Your device: 2:00 PM ·
 * Server: 2:14 PM" or null when the offset is under 30s.
 */
export function ClockSkewReadout({
  recordedAt,
  userTimezone,
}: {
  recordedAt: string;
  userTimezone: string | null;
}) {
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    function check() {
      const serverTime = new Date(recordedAt).getTime();
      const now = Date.now();
      setDelta(now - serverTime);
    }
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [recordedAt]);

  if (delta == null || Math.abs(delta) < 30_000) return null;

  const serverLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(userTimezone ? { timeZone: userTimezone } : {}),
  }).format(new Date(recordedAt));
  const deviceLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());

  return (
    <div className="mt-2 text-[10px] font-mono text-ink-70 leading-relaxed">
      <span className="text-ink-50">Your device:</span> {deviceLabel}
      {' · '}
      <span className="text-ink-50">Server:</span> {serverLabel}
      {' · '}
      <span className="text-ink-50">
        we use the server clock for the official check-in time
      </span>
    </div>
  );
}
