'use client';

import type { PresenceStatus } from './PresenceProvider';

const COLORS: Record<PresenceStatus, string> = {
  online: 'bg-success',   // green
  idle: 'bg-warning',     // amber
  offline: 'bg-ink-30',   // gray
};

const LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline',
};

/**
 * PresenceDot — small colored circle indicating online/idle/offline
 * status. Use inline next to a name/avatar.
 *
 *   <PresenceDot status="online" />                 // 8px
 *   <PresenceDot status="idle" withLabel />         // 8px + "Idle"
 *   <PresenceDot status="online" size="lg" />       // 14px
 */
export function PresenceDot({
  status,
  withLabel = false,
  size = 'sm',
  className = '',
}: {
  status: PresenceStatus;
  withLabel?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dim = size === 'xs' ? 'w-1.5 h-1.5' : size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-block ${dim} ${COLORS[status]} rounded-full ring-2 ring-paper`}
        aria-label={LABELS[status]}
        title={LABELS[status]}
      />
      {withLabel ? (
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          {LABELS[status]}
        </span>
      ) : null}
    </span>
  );
}
