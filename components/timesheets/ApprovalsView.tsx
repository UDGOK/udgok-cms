'use client';

/**
 * ApprovalsView — the pending list for admins/PMs.
 *
 * Each row has:
 *   - person (name + role/trade)
 *   - week
 *   - total hours + event count
 *   - "Open timesheet" link (drill-down)
 *   - Approve / Reject inline actions
 *
 * Approve is a one-click; Reject expands an inline
 * note input.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  approveTimesheetAction,
  rejectTimesheetAction,
} from '@/lib/timesheets/approvals';

interface PendingRow {
  id: string;
  personKind: 'employee' | 'sub';
  personId: string;
  personName: string;
  personSecondary: string | null;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  eventCount: number;
  submittedAt: string;
  submittedByName: string | null;
}

export function ApprovalsView({
  workspaceSlug,
  pending,
}: {
  workspaceSlug: string;
  pending: PendingRow[];
}) {
  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <div className="mb-4">
        <Link
          href={`/w/${workspaceSlug}/timesheets`}
          className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
        >
          ← Back to timesheets
        </Link>
      </div>

      <div className="mb-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
          Approvals
        </div>
        <h1 className="text-2xl font-black mt-0.5">
          Pending timesheets
          <span className="ml-2 text-[14px] font-mono text-ink-50">
            ({pending.length})
          </span>
        </h1>
      </div>

      {pending.length === 0 ? (
        <div className="bg-cream-2 border-2 border-line p-8 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">✓</div>
          <div className="text-[14px] font-extrabold text-ink">All caught up</div>
          <div className="text-[11px] text-ink-50 mt-1">
            No submitted timesheets are awaiting your review.
          </div>
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink divide-y divide-line">
          {pending.map((p) => (
            <ApprovalRow
              key={`${p.personKind}:${p.personId}:${p.weekStart}`}
              row={p}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalRow({
  row,
  workspaceSlug,
}: {
  row: PendingRow;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    const fd = new FormData();
    fd.set('personKind', row.personKind);
    fd.set('personId', row.personId);
    fd.set('weekStart', row.weekStart);
    startTransition(async () => {
      const res = await approveTimesheetAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? 'Approve failed');
      }
    });
  }

  function reject() {
    if (!rejectNote.trim()) {
      setError('Rejection note is required');
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set('personKind', row.personKind);
    fd.set('personId', row.personId);
    fd.set('weekStart', row.weekStart);
    fd.set('note', rejectNote);
    startTransition(async () => {
      const res = await rejectTimesheetAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        setShowReject(false);
        setRejectNote('');
        router.refresh();
      } else {
        setError(res.error ?? 'Reject failed');
      }
    });
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-ink text-[14px]">
            {row.personName}
            {row.personSecondary ? (
              <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                {row.personSecondary}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-ink-70 font-mono mt-0.5">
            Week of {new Date(row.weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(row.weekEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            <span className="text-ink font-extrabold">{row.totalHours}h</span>
            {' · '}
            {row.eventCount} {row.eventCount === 1 ? 'event' : 'events'}
          </div>
          {row.submittedByName ? (
            <div className="text-[10px] text-ink-50 mt-0.5 font-mono">
              Submitted by {row.submittedByName}
              {' · '}
              {new Date(row.submittedAt).toLocaleString()}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={
              row.personKind === 'employee'
                ? `/w/${workspaceSlug}/timesheets/employee/${row.personId}?week=${row.weekStart}`
                : `/w/${workspaceSlug}/timesheets/sub/${row.personId}?week=${row.weekStart}`
            }
            className="px-2 py-1 border border-line text-ink-70 text-[10px] font-extrabold uppercase tracking-[0.12em] hover:border-ink hover:text-ink"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={() => setShowReject((s) => !s)}
            disabled={pending}
            className="px-2 py-1 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={pending}
            className="px-2 py-1 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-success hover:bg-success/90 disabled:opacity-50"
          >
            {pending ? '…' : 'Approve'}
          </button>
        </div>
      </div>

      {showReject ? (
        <div className="mt-2 bg-error/5 border-2 border-error/30 p-2 flex flex-col gap-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-error font-extrabold">
            Rejection note (required)
          </div>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Tuesday's hours are missing the lunch break — please correct and resubmit"
            className="w-full px-2 py-1 bg-paper border border-line text-[12px] text-ink resize-none focus:outline-none focus:border-error"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setShowReject(false);
                setRejectNote('');
                setError(null);
              }}
              className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-70 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={pending || !rejectNote.trim()}
              className="px-2 py-1 bg-error text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              Confirm reject
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 text-[10px] font-mono text-error bg-error/10 border border-error px-2 py-1">
          {error}
        </div>
      ) : null}
    </div>
  );
}
