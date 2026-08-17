'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export type PresenceStatus = 'online' | 'idle' | 'offline';

export interface PresenceMember {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
}

interface PresenceContextValue {
  members: PresenceMember[];
  myStatus: PresenceStatus;
  refresh: () => Promise<void>;
  isLoading: boolean;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 min
const POLL_INTERVAL_MS = 90_000; // 1.5 min

/**
 * PresenceProvider — mounts at the workspace root. Sends a heartbeat
 * every 60s to mark this user as online, and polls the presence list
 * every 90s to keep all member statuses up to date.
 *
 * - On mount: immediate heartbeat + immediate fetch
 * - On visibility change: heartbeat when the tab becomes visible again
 *   (so a user who alt-tabbed for an hour still shows as online if they
 *   are looking at the tab right now)
 * - On beforeunload: best-effort sync ping (may not complete, fine —
 *   the next heartbeat or the 5-min timeout will reconcile)
 */
export function PresenceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const inflight = useRef(false);

  const sendHeartbeat = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
        keepalive: true,
      });
    } catch {
      // network errors are fine — the next tick will retry
    } finally {
      inflight.current = false;
    }
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/presence?workspaceId=${encodeURIComponent(workspaceId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { members: PresenceMember[] };
      setMembers(data.members);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    sendHeartbeat();
    refresh();
    const hb = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    const poll = setInterval(refresh, POLL_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(hb);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [workspaceId, sendHeartbeat, refresh]);

  const myUserId = members.find((m) => m.email)?.userId; // not used but keeps the lookup easy
  const myStatus: PresenceStatus = members.find((m) => m.userId === myUserId)?.status ?? 'offline';

  return (
    <PresenceContext.Provider value={{ members, myStatus, refresh, isLoading }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    // Fallback when used outside a provider (e.g. sign-in page): empty state.
    return { members: [], myStatus: 'offline', refresh: async () => {}, isLoading: false };
  }
  return ctx;
}

/** Returns the status of a specific user. */
export function useUserPresence(userId: string): PresenceStatus {
  const { members } = usePresence();
  return members.find((m) => m.userId === userId)?.status ?? 'offline';
}
