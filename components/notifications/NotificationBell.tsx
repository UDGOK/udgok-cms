'use client';

/**
 * NotificationBell — the bell button + count badge +
 * dropdown panel. Renders in the topbar for every
 * signed-in user. The panel pops open below the
 * bell, right-aligned, and closes on outside-click
 * or Escape.
 *
 * Permissioning for the "Send alert" button at the
 * top of the panel: only OWNER / ADMIN / PM / FIELD
 * can push. The button is hidden otherwise. We pass
 * `canPush` from the server (the workspace layout
 * already knows the caller's role).
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from './useNotifications';
import { NotificationPanel } from './NotificationPanel';
import { ComposeNotificationModal } from './ComposeNotificationModal';
import { useState } from 'react';

interface NotificationBellProps {
  workspaceId: string;
  workspaceSlug: string;
  canPush: boolean;
  /**
   * Roster of workspace members for the compose
   * modal's recipient picker. Pass an empty list
   * if canPush is false (the modal won't render).
   */
  members: Array<{ id: string; name: string; role: string }>;
}

export function NotificationBell({
  workspaceId,
  workspaceSlug,
  canPush,
  members,
}: NotificationBellProps) {
  const router = useRouter();
  const {
    count,
    panel,
    isOpen,
    isLoading,
    error,
    open,
    close,
    markRead,
    markAllRead,
    dismiss,
  } = useNotifications();

  const [composeOpen, setComposeOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click. The containerRef wraps
  // both the bell button and the panel so clicking
  // inside the panel doesn't close it.
  useEffect(() => {
    if (!isOpen) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  // Show "9+" when count is 10+. The badge has
  // limited horizontal space; a 3-digit number
  // would crowd the bell icon.
  const badgeLabel = count === 0 ? null : count > 9 ? '9+' : String(count);

  // Click handler: clicking the bell row navigates
  // to the link + marks read.
  async function handleRowClick(id: string, link: string | null) {
    await markRead(id);
    if (link) {
      close();
      // If the link is workspace-relative, prepend
      // the workspace slug. The compose form already
      // builds full paths, but the row link in the
      // panel might be a relative path like
      // "/projects/abc". We resolve it against the
      // current workspace.
      const target = link.startsWith('/w/')
        ? link
        : link.startsWith('/')
          ? `/w/${workspaceSlug}${link}`
          : link;
      router.push(target);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        className="
          w-[34px] h-[34px] flex items-center justify-center
          bg-paper border border-line
          text-ink-70 hover:border-ink hover:text-ink
          relative
        "
        aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {badgeLabel ? (
          <span
            className="
              absolute -top-1.5 -right-1.5
              min-w-[18px] h-[18px] px-1
              bg-orange text-paper
              text-[10px] font-extrabold leading-[18px] text-center
              rounded-full border-2 border-paper
            "
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="
            absolute right-0 top-[calc(100%+8px)] z-50
            w-[360px] max-w-[calc(100vw-24px)]
            bg-paper border-2 border-ink
            shadow-[4px_4px_0_0_var(--ink)]
          "
        >
          <NotificationPanel
            panel={panel}
            isLoading={isLoading}
            error={error}
            canPush={canPush}
            onSendAlert={() => setComposeOpen(true)}
            onMarkAllRead={markAllRead}
            onRowClick={handleRowClick}
            onDismiss={dismiss}
            onClose={close}
          />
        </div>
      ) : null}

      {composeOpen ? (
        <ComposeNotificationModal
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          members={members}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            // Refresh the panel so the new rows show
            // up immediately.
            // (The hook polls on its own; this is
            // just a faster trigger for the
            // pusher's own panel.)
            close();
          }}
        />
      ) : null}
    </div>
  );
}
