'use client';

/**
 * useNotifications — the bell's data hook.
 *
 * Manages:
 *   - unread count (badge number)
 *   - panel payload (unread + earlier lists)
 *   - polling cadence (30s while panel open, 60s
 *     while closed, paused when tab hidden)
 *   - optimistic mark-read / dismiss so the UI
 *     updates without waiting for the server
 *
 * The hook is the single source of truth for the
 * bell and the panel. The bell reads `count`, the
 * panel reads `panel` + the mutation helpers.
 *
 * Why one hook (not separate ones for the bell
 * and the panel): both surfaces need the same
 * fresh data, and the polling is shared. Splitting
 * them would mean two timers, two fetches, and
 * potential drift between the badge number and the
 * panel list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationView } from '@/lib/notifications/types';

interface PanelPayload {
  unread: NotificationView[];
  earlier: NotificationView[];
  counts: { unread: number };
}

interface UseNotificationsResult {
  count: number;
  panel: PanelPayload | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  open: () => void;
  close: () => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

const POLL_MS_CLOSED = 60_000;
const POLL_MS_OPEN = 30_000;

export function useNotifications(): UseNotificationsResult {
  const [panel, setPanel] = useState<PanelPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the count from the panel payload so the
  // badge and the list never disagree. If the panel
  // is null (initial state), count is 0.
  const count = panel?.counts.unread ?? 0;

  // Keep the latest open state in a ref so the
  // polling effect can read it without re-running
  // the effect every toggle.
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // The poll function — fetches the panel payload
  // and updates state. Wrapped in useCallback so
  // the polling effect has a stable reference.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', {
        cache: 'no-store',
        // The Clerk middleware returns 307 → /sign-in for
        // unauthenticated API calls. The default fetch
        // follows that redirect, ending up at an HTML
        // page that breaks res.json() with a SyntaxError.
        // The browser fetch API exposes `res.redirected`
        // so we can detect this case and surface a clean
        // "not signed in" instead of an opaque JSON
        // parse error.
      });
      if (res.redirected) {
        setError('Not signed in');
        return;
      }
      if (!res.ok) {
        setError(res.status === 401 ? 'Not signed in' : 'Failed to load');
        return;
      }
      const data = (await res.json()) as PanelPayload;
      setPanel(data);
      setError(null);
    } catch (err) {
      console.error('[notifications] refresh error:', err);
      setError('Network error');
    }
  }, []);

  // On mount, do an immediate fetch so the bell
  // shows the right count on first render instead
  // of a placeholder. Subsequent fetches come from
  // the polling loop.
  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  // Polling loop. Re-runs when refresh changes
  // (never in practice — useCallback'd to []).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function schedule() {
      // Don't poll if the tab is hidden — the
      // user isn't looking, and the next time
      // they focus the tab we kick a refresh.
      if (document.hidden) return;
      const ms = isOpenRef.current ? POLL_MS_OPEN : POLL_MS_CLOSED;
      timer = setTimeout(async () => {
        await refresh();
        schedule();
      }, ms);
    }
    schedule();

    function onVisibility() {
      if (document.hidden) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } else {
        // Tab came back to front — refresh
        // immediately so the user sees fresh
        // data.
        refresh();
        schedule();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  // When the panel opens, fetch fresh data so the
  // user always sees the latest list — the
  // 30-60s poll might have missed a recent
  // notification.
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Optimistic mark-read. We update local state
  // immediately, then call the server. If the
  // server fails, we refresh to revert.
  const markRead = useCallback(
    async (id: string) => {
      if (!panel) return;
      // Snapshot for rollback.
      const previous = panel;
      // Update local: move from unread to earlier,
      // set readAt, decrement count.
      setPanel({
        unread: panel.unread.filter((n) => n.id !== id),
        earlier: [
          { ...panel.unread.find((n) => n.id === id)!, readAt: new Date().toISOString() },
          ...panel.earlier,
        ].filter(Boolean) as NotificationView[],
        counts: { unread: Math.max(0, panel.counts.unread - 1) },
      });

      try {
        const fd = new FormData();
        fd.set('id', id);
        const res = await fetch('/api/notifications', {
          method: 'PATCH',
          body: fd,
        });
        if (!res.ok) {
          // Roll back.
          setPanel(previous);
        }
      } catch {
        setPanel(previous);
      }
    },
    [panel],
  );

  const markAllRead = useCallback(async () => {
    if (!panel) return;
    const previous = panel;
    // Move all unread to earlier with readAt=now.
    const nowIso = new Date().toISOString();
    setPanel({
      unread: [],
      earlier: [
        ...panel.unread.map((n) => ({ ...n, readAt: nowIso })),
        ...panel.earlier,
      ].slice(0, 50),
      counts: { unread: 0 },
    });

    try {
      const fd = new FormData();
      fd.set('all', 'true');
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        body: fd,
      });
      if (!res.ok) setPanel(previous);
    } catch {
      setPanel(previous);
    }
  }, [panel]);

  const dismiss = useCallback(
    async (id: string) => {
      if (!panel) return;
      const previous = panel;
      setPanel({
        unread: panel.unread.filter((n) => n.id !== id),
        earlier: panel.earlier.filter((n) => n.id !== id),
        counts: {
          unread: panel.counts.unread - (panel.unread.some((n) => n.id === id) ? 1 : 0),
        },
      });
      try {
        const fd = new FormData();
        fd.set('id', id);
        const res = await fetch('/api/notifications', {
          method: 'DELETE',
          body: fd,
        });
        if (!res.ok) setPanel(previous);
      } catch {
        setPanel(previous);
      }
    },
    [panel],
  );

  return {
    count,
    panel,
    isOpen,
    isLoading,
    error,
    open,
    close,
    refresh,
    markRead,
    markAllRead,
    dismiss,
  };
}
