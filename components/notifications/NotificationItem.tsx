'use client';

/**
 * NotificationItem — a single row in the bell panel.
 *
 * Layout:
 *   [type icon] [title + body + timestamp + sent-by]
 *                                       [× dismiss]
 *
 * The whole row is a clickable button (so click
 * navigates and marks read in one motion). The
 * dismiss × is a separate button nested inside — it
 * stops propagation so clicking × doesn't also
 * trigger the row's click handler.
 */

import type { NotificationView } from '@/lib/notifications/types';

interface NotificationItemProps {
  row: NotificationView;
  onClick: () => void;
  onDismiss: () => void;
}

export function NotificationItem({ row, onClick, onDismiss }: NotificationItemProps) {
  const isUnread = row.readAt === null;
  return (
    <div
      className={`
        relative group
        border-b border-line last:border-b-0
        ${isUnread ? 'bg-paper' : 'bg-cream-2/40'}
        hover:bg-cream-2
        transition-colors
      `}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2.5"
      >
        <TypeIcon type={row.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {isUnread ? (
              <span
                className="w-1.5 h-1.5 bg-orange rounded-full shrink-0"
                aria-label="Unread"
              />
            ) : null}
            <div
              className={`
                text-[12px] leading-tight truncate
                ${isUnread ? 'font-extrabold text-ink' : 'font-semibold text-ink-70'}
              `}
            >
              {row.title}
            </div>
          </div>
          {row.body ? (
            <div className="text-[11px] text-ink-70 mt-0.5 line-clamp-2 leading-snug">
              {row.body}
            </div>
          ) : null}
          <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1">
            {relativeTime(row.createdAt)}
            {row.createdBy ? (
              <> · from {row.createdBy.name}</>
            ) : null}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Dismiss notification"
        className="
          absolute top-1.5 right-1.5
          w-5 h-5 flex items-center justify-center
          text-ink-50 hover:text-ink
          opacity-0 group-hover:opacity-100
          focus:opacity-100
        "
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function TypeIcon({ type }: { type: NotificationView['type'] }) {
  // Tiny 16x16 icons keyed off type. Each gets a
  // distinct background colour so the row is
  // glanceable.
  const palette: Record<NotificationView['type'], { bg: string; fg: string; path: React.ReactNode }> = {
    team_push: {
      bg: 'bg-orange/15',
      fg: 'text-orange',
      path: (
        <path d="M3 11l18-8-8 18-2-8-8-2z" />
      ),
    },
    checkin: {
      bg: 'bg-success/15',
      fg: 'text-success',
      path: (
        <>
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ),
    },
    pay_app: {
      bg: 'bg-info/15',
      fg: 'text-info',
      path: (
        <>
          <rect x="3" y="6" width="18" height="13" rx="1" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      ),
    },
    task: {
      bg: 'bg-warning/15',
      fg: 'text-warning',
      path: (
        <>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <polyline points="9 12 11 14 15 10" />
        </>
      ),
    },
    project: {
      bg: 'bg-ink-50/15',
      fg: 'text-ink',
      path: (
        <>
          <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
          <line x1="3" y1="7" x2="12" y2="11" />
          <line x1="12" y1="11" x2="21" y2="7" />
        </>
      ),
    },
    system: {
      bg: 'bg-ink-30/20',
      fg: 'text-ink-50',
      path: (
        <>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </>
      ),
    },
  };
  const { bg, fg, path } = palette[type] ?? palette.system;
  return (
    <div
      className={`
        w-7 h-7 shrink-0
        flex items-center justify-center
        ${bg} ${fg}
      `}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-3.5 h-3.5"
        aria-hidden="true"
      >
        {path}
      </svg>
    </div>
  );
}

/**
 * "2m ago" / "3h ago" / "yesterday" / "Aug 4".
 * Lightweight, no date library — Intl + a small
 * threshold ladder. For v1 we don't need true
 * RelativeTime (which would auto-update every
 * minute); the panel refreshes every 30s, so the
 * label updates on the next poll.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
