'use client';

/**
 * NotificationPanel — the dropdown content. Rendered
 * inside the bell's popover. Two sections ("New" +
 * "Earlier"), a header with "Mark all read" +
 * optional "Send alert" + a footer with the count
 * for the user's reference.
 *
 * The list rows themselves live in
 * NotificationItem; this file is the layout shell.
 */

import { NotificationItem } from './NotificationItem';
import type { NotificationView } from '@/lib/notifications/types';

interface NotificationPanelProps {
  panel: {
    unread: NotificationView[];
    earlier: NotificationView[];
    counts: { unread: number };
  } | null;
  isLoading: boolean;
  error: string | null;
  canPush: boolean;
  onSendAlert: () => void;
  onMarkAllRead: () => void;
  onRowClick: (id: string, link: string | null) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function NotificationPanel({
  panel,
  isLoading,
  error,
  canPush,
  onSendAlert,
  onMarkAllRead,
  onRowClick,
  onDismiss,
}: NotificationPanelProps) {
  const unread = panel?.unread ?? [];
  const earlier = panel?.earlier ?? [];
  const unreadCount = panel?.counts.unread ?? 0;
  const isEmpty = unread.length === 0 && earlier.length === 0;

  return (
    <div className="flex flex-col max-h-[min(80vh,560px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b-2 border-ink bg-cream">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            Notifications
          </div>
          {unreadCount > 0 ? (
            <div className="text-[11px] font-extrabold text-ink">
              {unreadCount} new
            </div>
          ) : (
            <div className="text-[11px] text-ink-50">All caught up</div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {canPush ? (
            <button
              type="button"
              onClick={onSendAlert}
              className="
                text-[10px] font-extrabold uppercase tracking-[0.12em]
                px-2 py-1
                bg-orange text-paper hover:bg-orange-d
              "
            >
              + Send alert
            </button>
          ) : null}
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="
                text-[10px] font-extrabold uppercase tracking-[0.12em]
                px-2 py-1
                bg-cream-2 text-ink-70 border border-line
                hover:border-ink hover:text-ink
              "
            >
              Mark all read
            </button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {error ? (
          <div className="px-3 py-6 text-center">
            <div className="text-[12px] text-error font-mono">
              {error}
            </div>
            <div className="text-[10px] text-ink-50 mt-1">
              Notifications will retry on the next refresh.
            </div>
          </div>
        ) : isLoading && !panel ? (
          <div className="px-3 py-6 text-center">
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-50">
              Loading…
            </div>
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {unread.length > 0 ? (
              <Section title="New" rows={unread} onRowClick={onRowClick} onDismiss={onDismiss} />
            ) : null}
            {earlier.length > 0 ? (
              <Section title="Earlier" rows={earlier} onRowClick={onRowClick} onDismiss={onDismiss} />
            ) : null}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-line bg-cream">
        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink-50 text-center">
          {panel
            ? `${unreadCount} unread · ${earlier.length} read`
            : '—'}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  onRowClick,
  onDismiss,
}: {
  title: string;
  rows: NotificationView[];
  onRowClick: (id: string, link: string | null) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-3 pt-2.5 pb-1 text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50">
        {title}
      </div>
      {rows.map((row) => (
        <NotificationItem
          key={row.id}
          row={row}
          onClick={() => onRowClick(row.id, row.link)}
          onDismiss={() => onDismiss(row.id)}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-10 text-center">
      <div className="text-3xl mb-2" aria-hidden="true">
        🔕
      </div>
      <div className="text-[12px] font-extrabold text-ink">
        No notifications
      </div>
      <div className="text-[11px] text-ink-50 mt-1 leading-relaxed">
        When teammates push an alert, or a system event
        fires on a project you{'\u2019'}re on, it will show up here.
      </div>
    </div>
  );
}
