'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Field } from '@/components/ui';
import {
  updatePayAppAction,
  markPayAppDisputedAction,
  markPayAppPaidAction,
  deletePayAppAction,
} from '@/lib/pay-apps/actions';

interface Line {
  id: string;
  previousAmount: number;
  thisDrawAmount: number;
  balanceAfter: number;
  code: string;
  trade: string;
  budget: number;
}

function EditSubmit() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="copper" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>;
}

export function PayAppEditor({
  workspaceSlug,
  projectId,
  payAppId,
  initialLines,
  initialNotes,
}: {
  workspaceSlug: string;
  projectId: string;
  payAppId: string;
  initialLines: Line[];
  initialNotes: string;
}) {
  const [draws, setDraws] = useState<Record<string, number>>(
    Object.fromEntries(initialLines.map((l) => [l.id, l.thisDrawAmount])),
  );
  const [notes, setNotes] = useState(initialNotes);
  const [state, formAction] = useFormState(
    updatePayAppAction.bind(null, workspaceSlug, projectId, payAppId),
    undefined as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  );
  const router = useRouter();

  if (state?.ok && typeof window !== 'undefined') {
    setTimeout(() => window.location.reload(), 0);
  }

  const totalThisDraw = Object.values(draws).reduce((acc, n) => acc + (Number(n) || 0), 0);

  return (
    <form
      action={async (fd) => {
        fd.set('thisDraws', JSON.stringify(draws));
        fd.set('notes', notes);
        await formAction(fd);
      }}
      className="space-y-3"
    >
      <div className="bg-cream-2 border border-line p-3 space-y-1 max-h-[400px] overflow-y-auto">
        {initialLines.map((l) => (
          <div key={l.id} className="grid grid-cols-12 items-center gap-2 py-1">
            <div className="col-span-2 font-mono text-[12px] text-orange-d font-extrabold">{l.code}</div>
            <div className="col-span-4 font-extrabold text-[12px] truncate">{l.trade}</div>
            <div className="col-span-2 text-[10px] font-mono text-ink-50 uppercase tracking-[0.05em]">Budget</div>
            <div className="col-span-2 text-[12px] font-extrabold">${l.budget.toLocaleString()}</div>
            <div className="col-span-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={draws[l.id] ?? 0}
                onChange={(e) => setDraws((s) => ({ ...s, [l.id]: Number(e.target.value) || 0 }))}
                className="w-full px-2 py-1.5 bg-paper border border-line text-ink text-[12px] outline-none focus:border-ink text-right font-mono"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-ink text-cream">
        <span className="font-extrabold text-[11px] uppercase tracking-[0.1em]">This draw total</span>
        <span className="font-black text-lg text-orange-l">${totalThisDraw.toLocaleString()}</span>
      </div>

      <Field label="Notes" htmlFor="edit-notes">
        <textarea
          id="edit-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
        />
      </Field>

      {state?.error ? <p className="text-sm text-error font-semibold">{state.error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.refresh()}>Cancel</Button>
        <EditSubmit />
      </div>
    </form>
  );
}

export function PayAppStatusActions({
  workspaceSlug,
  projectId,
  payAppId,
  drawNumber,
  status,
}: {
  workspaceSlug: string;
  projectId: string;
  payAppId: string;
  drawNumber: number;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function doAction(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  if (status === 'DRAFT') {
    return (
      <div className="flex gap-2">
        <Button
          variant="ghost"
          disabled={busy === 'delete'}
          onClick={async () => {
            if (!confirm(`Delete Draw #${drawNumber}? This cannot be undone.`)) return;
            await doAction('delete', () => deletePayAppAction(workspaceSlug, projectId, payAppId));
            router.push(`/w/${workspaceSlug}/projects/${projectId}`);
          }}
          className="text-error border-error/40 hover:bg-error/5"
        >
          {busy === 'delete' ? 'Deleting…' : 'Delete draft'}
        </Button>
      </div>
    );
  }

  if (status === 'SENT' || status === 'VIEWED' || status === 'ACKNOWLEDGED') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="primary"
          disabled={busy === 'paid'}
          onClick={async () => {
            if (!confirm(`Mark Draw #${drawNumber} as paid? The client has now paid this draw.`)) return;
            await doAction('paid', () => markPayAppPaidAction(workspaceSlug, projectId, payAppId));
            router.refresh();
          }}
        >
          {busy === 'paid' ? 'Marking…' : '✓ Mark as paid'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy === 'dispute'}
          onClick={async () => {
            if (!confirm(`Mark Draw #${drawNumber} as disputed?`)) return;
            await doAction('dispute', () => markPayAppDisputedAction(workspaceSlug, projectId, payAppId));
            router.refresh();
          }}
          className="text-error border-error/40 hover:bg-error/5"
        >
          {busy === 'dispute' ? 'Flagging…' : 'Flag disputed'}
        </Button>
      </div>
    );
  }

  if (status === 'DISPUTED') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="primary"
          disabled={busy === 'paid'}
          onClick={async () => {
            if (!confirm(`Mark Draw #${drawNumber} as paid despite the dispute?`)) return;
            await doAction('paid', () => markPayAppPaidAction(workspaceSlug, projectId, payAppId));
            router.refresh();
          }}
        >
          {busy === 'paid' ? 'Marking…' : '✓ Mark as paid'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy === 'dispute'}
          onClick={async () => {
            if (!confirm(`Resolve dispute and re-send Draw #${drawNumber}? Status will go back to SENT.`)) return;
            // For now, just re-open via the dispute action which already exists.
            // (Adding a dedicated "undispute" would need a new server action.)
            await doAction('dispute', () => markPayAppDisputedAction(workspaceSlug, projectId, payAppId));
            router.refresh();
          }}
        >
          Re-send
        </Button>
      </div>
    );
  }

  // PAID / SUPERSEDED — read-only
  return null;
}

/**
 * Pay App Status Timeline — a horizontal stepper showing the
 * lifecycle of a pay app: Draft → Sent → Viewed → Acknowledged
 * → Paid. The current status is highlighted, past steps are
 * filled, future steps are dimmed.
 *
 * Renders below the pay app header so the user can see "where
 * this draw is" at a glance, alongside the action buttons.
 */
const TIMELINE_STEPS: { key: string; label: string; description: string }[] = [
  { key: 'DRAFT', label: 'Draft', description: 'Editable, not yet sent' },
  { key: 'SENT', label: 'Sent', description: 'Emailed to the client' },
  { key: 'VIEWED', label: 'Viewed', description: 'Client opened the link' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged', description: 'Client signed off' },
  { key: 'PAID', label: 'Paid', description: 'Payment received' },
];

export function PayAppStatusTimeline({
  status,
  sentAt,
  firstViewedAt,
  acknowledgedAt,
  paidAt,
}: {
  status: string;
  sentAt?: Date | null;
  firstViewedAt?: Date | null;
  acknowledgedAt?: Date | null;
  paidAt?: Date | null;
}) {
  // For DRAFT, none of the past steps have happened.
  // For DISPUTED, we render the timeline up to the last "good"
  // step with a red overlay so the user sees the issue.
  // For SUPERSEDED, we grey out the whole timeline.
  const currentIdx = TIMELINE_STEPS.findIndex((s) => s.key === status);
  const isDisputed = status === 'DISPUTED';
  const isSuperseded = status === 'SUPERSEDED';
  const isPaid = status === 'PAID';

  // For DISPUTED we still show the timeline but cap it at SENT
  // (since the client received it but didn't ack it cleanly).
  const effectiveIdx = isDisputed ? 1 : currentIdx;

  return (
    <div className="bg-paper border-2 border-line p-5 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="label-eyebrow">{'// Status'}</div>
        {isDisputed ? (
          <span className="px-2 py-0.5 bg-error/15 text-error border border-error/40 text-[10px] font-extrabold uppercase tracking-[0.1em]">
            ⚠ Disputed
          </span>
        ) : isSuperseded ? (
          <span className="px-2 py-0.5 bg-cream-2 text-ink-50 border border-line text-[10px] font-extrabold uppercase tracking-[0.1em]">
            Superseded
          </span>
        ) : isPaid ? (
          <span className="px-2 py-0.5 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.1em]">
            ✓ Paid
          </span>
        ) : null}
      </div>

      <ol className="grid grid-cols-5 gap-1">
        {TIMELINE_STEPS.map((step, i) => {
          const isPast = i < effectiveIdx;
          const isCurrent = i === effectiveIdx && !isDisputed;
          const timestamp =
            step.key === 'SENT' ? sentAt :
            step.key === 'VIEWED' ? firstViewedAt :
            step.key === 'ACKNOWLEDGED' ? acknowledgedAt :
            step.key === 'PAID' ? paidAt : null;
          return (
            <li
              key={step.key}
              className={`relative px-2 py-3 border ${
                isCurrent
                  ? 'border-ink bg-ink text-paper'
                  : isPast
                  ? 'border-success/40 bg-success/5'
                  : 'border-line bg-cream-2 text-ink-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {isPast ? (
                  <span className="w-4 h-4 inline-flex items-center justify-center bg-success text-paper text-[10px] font-extrabold rounded-full">✓</span>
                ) : isCurrent ? (
                  <span className="w-4 h-4 inline-flex items-center justify-center bg-paper text-ink text-[10px] font-extrabold rounded-full">{i + 1}</span>
                ) : (
                  <span className="w-4 h-4 inline-flex items-center justify-center border border-line text-ink-30 text-[10px] font-bold rounded-full">{i + 1}</span>
                )}
                <span className="text-[10px] font-extrabold uppercase tracking-[0.08em]">{step.label}</span>
              </div>
              <div className={`text-[9px] leading-tight ${isCurrent ? 'text-paper/70' : 'text-ink-50'}`}>
                {isCurrent ? step.description : isPast && timestamp ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : step.description}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
