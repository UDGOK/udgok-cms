'use client';

/**
 * Timesheet action bar — submit / approve / reject /
 * unlock buttons for the per-person detail page.
 *
 * Self-service submit is available to the person
 * themselves. Approve / reject / unlock are admin/
 * PM-only. Reject shows an inline note input.
 *
 * All four actions go through the server actions in
 * lib/timesheets/approvals.ts. The bar re-renders
 * via router.refresh() so the status badge updates
 * without a full page reload.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitTimesheetAction,
  approveTimesheetAction,
  rejectTimesheetAction,
  unlockTimesheetAction,
} from '@/lib/timesheets/approvals';

interface TimesheetActionsProps {
  workspaceSlug: string;
  personKind: 'employee' | 'sub';
  personId: string;
  weekStart: string; // ISO
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | null;
  // Permission flags resolved server-side.
  canSubmit: boolean;
  canApprove: boolean;
}

export function TimesheetActions({
  workspaceSlug,
  personKind,
  personId,
  weekStart,
  status,
  canSubmit,
  canApprove,
}: TimesheetActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  function run(fn: (slug: string, prev: undefined, fd: FormData) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const fd = new FormData();
    fd.set('personKind', personKind);
    fd.set('personId', personId);
    fd.set('weekStart', weekStart);
    startTransition(async () => {
      const res = await fn(workspaceSlug, undefined, fd);
      if (res.ok) {
        setShowReject(false);
        setRejectNote('');
        router.refresh();
      } else {
        setError(res.error ?? 'Action failed');
      }
    });
  }

  function submit() {
    run(submitTimesheetAction);
  }
  function approve() {
    run(approveTimesheetAction);
  }
  function reject() {
    if (!rejectNote.trim()) {
      setError('Rejection note is required');
      return;
    }
    const fd = new FormData();
    fd.set('personKind', personKind);
    fd.set('personId', personId);
    fd.set('weekStart', weekStart);
    fd.set('note', rejectNote);
    setError(null);
    startTransition(async () => {
      const res = await rejectTimesheetAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        setShowReject(false);
        setRejectNote('');
        router.refresh();
      } else {
        setError(res.error ?? 'Action failed');
      }
    });
  }
  function unlock() {
    run(unlockTimesheetAction);
  }

  const effectiveStatus = status ?? 'DRAFT';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Submit (DRAFT or REJECTED) */}
        {canSubmit && (effectiveStatus === 'DRAFT' || effectiveStatus === 'REJECTED') ? (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="px-3 py-1.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d disabled:opacity-50"
          >
            {pending ? '…' : effectiveStatus === 'REJECTED' ? 'Resubmit' : 'Submit for approval'}
          </button>
        ) : null}

        {/* Approve (SUBMITTED) — approver only, and not self */}
        {canApprove && effectiveStatus === 'SUBMITTED' ? (
          <>
            <button
              type="button"
              onClick={approve}
              disabled={pending}
              className="px-3 py-1.5 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-success hover:bg-success/90 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setShowReject((s) => !s)}
              disabled={pending}
              className="px-3 py-1.5 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        ) : null}

        {/* Unlock (APPROVED) — approver only */}
        {canApprove && effectiveStatus === 'APPROVED' ? (
          <button
            type="button"
            onClick={unlock}
            disabled={pending}
            className="px-3 py-1.5 border-2 border-warning text-warning text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-warning/10 disabled:opacity-50"
          >
            Unlock to edit
          </button>
        ) : null}

        {/* SUBMITTED badge for non-approvers (waiting) */}
        {effectiveStatus === 'SUBMITTED' && !canApprove ? (
          <span className="px-3 py-1.5 bg-info/15 text-info text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-info/30">
            ⏳ Awaiting approval
          </span>
        ) : null}
      </div>

      {/* Reject note input */}
      {showReject ? (
        <div className="bg-error/5 border-2 border-error/30 p-2 flex flex-col gap-1.5">
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
        <div className="text-[10px] font-mono text-error bg-error/10 border border-error px-2 py-1">
          {error}
        </div>
      ) : null}
    </div>
  );
}
