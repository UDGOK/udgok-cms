'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Field } from '@/components/ui';
import { updatePayAppAction, markPayAppDisputedAction, deletePayAppAction } from '@/lib/pay-apps/actions';

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
      <div className="flex gap-2">
        <Button
          variant="ghost"
          disabled={busy === 'dispute'}
          onClick={async () => {
            if (!confirm(`Mark Draw #${drawNumber} as disputed?`)) return;
            await doAction('dispute', () => markPayAppDisputedAction(workspaceSlug, projectId, payAppId));
          }}
          className="text-error border-error/40 hover:bg-error/5"
        >
          {busy === 'dispute' ? 'Flagging…' : 'Flag disputed'}
        </Button>
      </div>
    );
  }

  return null;
}
