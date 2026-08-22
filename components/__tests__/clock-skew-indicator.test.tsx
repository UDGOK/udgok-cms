// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

/**
 * ClockSkewIndicator — regression tests.
 *
 * What the component does:
 *   1. Reads a server-stamped time from
 *      <div id="server-now" data-server-now="..."> in the
 *      DOM (rendered by the workspace layout / public
 *      check-in page).
 *   2. Compares it to Date.now() on the client.
 *   3. Shows a warning banner if |skew| >= 60s.
 *   4. The banner is dismissable for 24 hours via
 *      localStorage.
 *
 * These tests exercise the threshold logic, the
 * dismiss/persist flow, and the per-mount refresh.
 */

import { ClockSkewIndicator } from '../ClockSkewIndicator';

function stampServerTime(isoTime: string) {
  // The component reads `Number(el.getAttribute('data-server-now'))`
  // so we use ms-since-epoch, not an ISO string.
  const ms = new Date(isoTime).getTime();
  const el = document.createElement('div');
  el.id = 'server-now';
  el.setAttribute('data-server-now', String(ms));
  document.body.appendChild(el);
  return el;
}

function removeServerStamp() {
  const el = document.getElementById('server-now');
  if (el) el.remove();
}

describe('ClockSkewIndicator', () => {
  beforeEach(() => {
    localStorage.clear();
    removeServerStamp();
  });

  afterEach(() => {
    cleanup();
    removeServerStamp();
    vi.restoreAllMocks();
  });

  it('renders nothing when the device clock matches the server', () => {
    // Server time = client time (no drift).
    const realNow = Date.now;
    Date.now = () => new Date('2026-08-22T14:00:00Z').getTime();
    stampServerTime('2026-08-22T14:00:00Z');
    render(<ClockSkewIndicator />);
    expect(screen.queryByTestId('clock-skew-indicator')).toBeNull();
    Date.now = realNow;
  });

  it('renders nothing for a small skew under the 60s threshold', () => {
    // Server time is 30 seconds ahead of the client. Well
    // within the threshold — humans can't tell the
    // difference, and check-in granularity is 1 minute.
    const realNow = Date.now;
    Date.now = () => new Date('2026-08-22T14:00:30Z').getTime();
    stampServerTime('2026-08-22T14:00:00Z'); // 30s ago
    render(<ClockSkewIndicator />);
    expect(screen.queryByTestId('clock-skew-indicator')).toBeNull();
    Date.now = realNow;
  });

  it('shows a warning when the device clock is more than 60s behind the server', async () => {
    // Server says 14:05, device says 14:00 — 5 minutes
    // behind. The foreman's check-in times will look
    // ahead of their watch; flag it.
    const realNow = Date.now;
    Date.now = () => new Date('2026-08-22T14:00:00Z').getTime();
    stampServerTime('2026-08-22T14:05:00Z'); // 5 min ahead
    render(<ClockSkewIndicator />);
    // The component reads the stamp + Date.now in a
    // useEffect, so we need to wait for the post-mount
    // effect to run.
    await act(async () => {});
    expect(screen.getByTestId('clock-skew-indicator')).toBeTruthy();
    expect(screen.getByText(/5 minutes behind/i)).toBeTruthy();
    Date.now = realNow;
  });

  it('shows a warning when the device clock is more than 60s ahead of the server', async () => {
    // Server says 14:00, device says 14:05 — 5 minutes
    // ahead. The foreman's check-in times will look
    // behind their watch.
    const realNow = Date.now;
    Date.now = () => new Date('2026-08-22T14:05:00Z').getTime();
    stampServerTime('2026-08-22T14:00:00Z'); // 5 min behind
    render(<ClockSkewIndicator />);
    await act(async () => {});
    expect(screen.getByTestId('clock-skew-indicator')).toBeTruthy();
    expect(screen.getByText(/5 minutes ahead/i)).toBeTruthy();
    Date.now = realNow;
  });

  it('renders nothing if the server-time stamp is missing', () => {
    // No #server-now div. The component can't compare,
    // so it bails out silently rather than showing a
    // bogus skew against an undefined value.
    render(<ClockSkewIndicator />);
    expect(screen.queryByTestId('clock-skew-indicator')).toBeNull();
  });

  it('hides the warning after dismiss (24h localStorage TTL)', async () => {
    const realNow = Date.now;
    Date.now = () => new Date('2026-08-22T14:00:00Z').getTime();
    stampServerTime('2026-08-22T14:05:00Z');
    render(<ClockSkewIndicator />);
    await act(async () => {});
    expect(screen.getByTestId('clock-skew-indicator')).toBeTruthy();

    // Click the dismiss button. The banner should
    // disappear immediately AND the localStorage flag
    // should be set so we don't re-show within 24h.
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByTestId('clock-skew-indicator')).toBeNull();
    expect(localStorage.getItem('cms.clockSkew.dismissedAt')).toBeTruthy();

    // Re-mount: the dismissed flag should still be
    // respected (no flash of the warning on the next
    // page load).
    cleanup();
    render(<ClockSkewIndicator />);
    await act(async () => {});
    expect(screen.queryByTestId('clock-skew-indicator')).toBeNull();

    Date.now = realNow;
  });

  it('re-shows the warning after 24h have passed since dismiss', async () => {
    // Simulate "dismissed 25 hours ago" by writing a
    // timestamp from yesterday. The component should
    // re-show the warning because the TTL has elapsed.
    const realNow = Date.now;
    const oldDismiss = new Date('2026-08-21T05:00:00Z').getTime();
    localStorage.setItem('cms.clockSkew.dismissedAt', String(oldDismiss));
    Date.now = () => new Date('2026-08-22T06:00:00Z').getTime(); // 25h later
    stampServerTime('2026-08-22T06:05:00Z');
    render(<ClockSkewIndicator />);
    await act(async () => {});
    expect(screen.getByTestId('clock-skew-indicator')).toBeTruthy();
    Date.now = realNow;
  });
});
