'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { createPermitAction } from '@/lib/permits/actions';
import { PERMIT_STATUS_LABELS } from '@/lib/permits/queries';

const PERMIT_TYPE_SUGGESTIONS = [
  'Building',
  'Electrical',
  'Plumbing',
  'Mechanical',
  'Roofing',
  'Demolition',
  'Grading',
  'Driveway',
  'Fence',
  'Sign',
  'Pool',
  'Solar',
];

interface AddPermitFormProps {
  workspaceSlug: string;
  projectId: string;
  suggestedJurisdiction?: string | null;
}

export function AddPermitForm({
  workspaceSlug,
  projectId,
  suggestedJurisdiction,
}: AddPermitFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    (prev: unknown, formData: FormData) => createPermitAction(workspaceSlug, projectId, prev as never, formData),
    undefined,
  );

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d"
      >
        + Add permit
      </button>
    );
  }

  return (
    <form action={formAction} className="bg-cream-2 border-2 border-ink p-4 space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {'// New permit'}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Type *
          </label>
          <input
            type="text"
            name="type"
            list="permit-type-suggestions"
            required
            placeholder="Building, Electrical, Plumbing…"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
          <datalist id="permit-type-suggestions">
            {PERMIT_TYPE_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Permit number
          </label>
          <input
            type="text"
            name="permitNumber"
            placeholder="e.g. BLD-2026-04812"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue="NOT_APPLIED"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          >
            {Object.entries(PERMIT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Jurisdiction
          </label>
          <input
            type="text"
            name="jurisdiction"
            defaultValue={suggestedJurisdiction ?? ''}
            placeholder="e.g. City of Tulsa"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Applied
          </label>
          <input
            type="date"
            name="appliedDate"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Issued
          </label>
          <input
            type="date"
            name="issuedDate"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Expires
          </label>
          <input
            type="date"
            name="expirationDate"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Fee ($)
        </label>
        <input
          type="number"
          name="fee"
          step="0.01"
          min="0"
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        />
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          rows={2}
          maxLength={4000}
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        />
      </div>
      {'error' in (state ?? {}) && state?.error ? (
        <div className="text-[12px] text-error font-extrabold">{state.error}</div>
      ) : null}
      <div className="flex gap-2">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2.5 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Creating…' : 'Add permit'}
    </button>
  );
}
