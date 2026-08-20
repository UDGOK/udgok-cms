'use client';

/**
 * EditEventModal — admin override for a single
 * check-in event's hours / timestamps.
 *
 * Used from the per-employee and per-sub detail
 * pages. Renders inline below the event row when
 * triggered (no portal — simpler and matches the
 * rest of the design).
 *
 * Two pieces:
 *   1. Edit form (hours, timestamps, note)
 *   2. "Clear override" button (when editedHours
 *      is already set)
 *
 * The form is uncontrolled except for the hours
 * field which we pre-fill from the current value.
 * We use the server action via `useTransition` so
 * the modal stays open while the action runs.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { updateCheckInEventAction } from '@/lib/timesheets/actions';

interface EditEventModalProps {
  workspaceSlug: string;
  event: {
    id: string;
    checkedInAt: string;
    checkedOutAt: string | null;
    editedHours: number | null;
    editedByName: string | null;
    editedAt: string | null;
    editNote: string | null;
    computedHours: number | null;
  };
  onClose: () => void;
}

export function EditEventModal({
  workspaceSlug,
  event,
  onClose,
}: EditEventModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editedHours, setEditedHours] = useState(
    event.editedHours !== null ? String(event.editedHours) : '',
  );
  const [useOverride, setUseOverride] = useState(event.editedHours !== null);
  const [editNote, setEditNote] = useState(event.editNote ?? '');
  const [checkedInAt, setCheckedInAt] = useState(
    toLocalDateTimeInput(new Date(event.checkedInAt)),
  );
  const [checkedOutAt, setCheckedOutAt] = useState(
    event.checkedOutAt ? toLocalDateTimeInput(new Date(event.checkedOutAt)) : '',
  );
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on Escape or outside click.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('eventId', event.id);
    if (useOverride && editedHours) {
      fd.set('editedHours', editedHours);
      fd.set('editNote', editNote);
    } else if (!useOverride && event.editedHours !== null) {
      // Clearing an existing override.
      fd.set('editedHours', '');
    } else if (editNote) {
      fd.set('editNote', editNote);
    }
    if (checkedInAt) fd.set('checkedInAt', new Date(checkedInAt).toISOString());
    if (checkedOutAt) fd.set('checkedOutAt', new Date(checkedOutAt).toISOString());

    startTransition(async () => {
      const res = await updateCheckInEventAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  function clearOverride() {
    if (!confirm('Clear the admin override and revert to the system-computed hours?')) return;
    const fd = new FormData();
    fd.set('eventId', event.id);
    fd.set('editedHours', '');
    startTransition(async () => {
      const res = await updateCheckInEventAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/30 flex items-center justify-center p-4"
      role="dialog"
      aria-label="Edit check-in event"
    >
      <div
        ref={ref}
        className="w-full max-w-md bg-paper border-2 border-ink shadow-[4px_4px_0_0_var(--ink)]"
      >
        <div className="px-4 py-3 border-b-2 border-ink bg-cream flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
              Edit hours
            </div>
            <div className="text-[13px] font-extrabold text-ink mt-0.5">
              {new Date(event.checkedInAt).toLocaleString()}
              {event.checkedOutAt
                ? ` → ${new Date(event.checkedOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : ' · still open'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center text-ink-50 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          {/* Hours override */}
          <div>
            <label className="flex items-center gap-2 text-[11px] font-extrabold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={useOverride}
                onChange={(e) => setUseOverride(e.target.checked)}
              />
              Override hours
            </label>
            {useOverride ? (
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={editedHours}
                  onChange={(e) => setEditedHours(e.target.value)}
                  placeholder={event.computedHours !== null ? String(event.computedHours) : '0'}
                  className="w-24 px-2 py-1 bg-cream border border-line text-[13px] text-ink focus:outline-none focus:border-ink"
                />
                <span className="text-[11px] text-ink-50 font-mono">hours</span>
                {event.computedHours !== null ? (
                  <span className="text-[10px] font-mono text-ink-50">
                    (system says {event.computedHours}h)
                  </span>
                ) : null}
              </div>
            ) : event.computedHours !== null ? (
              <div className="text-[11px] text-ink-50 mt-1 font-mono">
                Using system-computed {event.computedHours}h
              </div>
            ) : null}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-1">
                Checked in
              </div>
              <input
                type="datetime-local"
                value={checkedInAt}
                onChange={(e) => setCheckedInAt(e.target.value)}
                className="w-full px-2 py-1 bg-cream border border-line text-[12px] text-ink focus:outline-none focus:border-ink"
              />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-1">
                Checked out
              </div>
              <input
                type="datetime-local"
                value={checkedOutAt}
                onChange={(e) => setCheckedOutAt(e.target.value)}
                className="w-full px-2 py-1 bg-cream border border-line text-[12px] text-ink focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          {/* Edit note */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-1">
              {useOverride ? 'Edit note (required for override)' : 'Note (optional)'}
            </div>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="e.g. foreman forgot to clock out for lunch"
              className="w-full px-2 py-1 bg-cream border border-line text-[12px] text-ink resize-none focus:outline-none focus:border-ink"
            />
          </div>

          {error ? (
            <div className="text-[11px] text-error font-mono bg-error/10 border border-error px-2 py-1.5">
              {error}
            </div>
          ) : null}

          {event.editedHours !== null && event.editedByName ? (
            <div className="text-[10px] font-mono text-ink-50 bg-cream-2 border border-line px-2 py-1.5">
              Override by {event.editedByName}
              {event.editedAt ? ` on ${new Date(event.editedAt).toLocaleString()}` : ''}
              {event.editNote ? `: "${event.editNote}"` : ''}
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-1">
            <div>
              {event.editedHours !== null ? (
                <button
                  type="button"
                  onClick={clearOverride}
                  disabled={pending}
                  className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50 hover:text-ink underline"
                >
                  Clear override
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-70 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || (useOverride && !editedHours)}
                className="px-3 py-1.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Format a Date as the value for an
 * <input type="datetime-local"> (YYYY-MM-DDTHH:MM).
 */
function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
