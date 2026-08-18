'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { updateProjectDetailsAction } from '@/lib/projects/actions';

interface EditProjectDetailsButtonProps {
  workspaceSlug: string;
  projectId: string;
  initial: {
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    description: string | null;
    startDate: Date | null;
    endDate: Date | null;
    contractValue: number | null;
    status: string;
  };
}

export function EditProjectDetailsButton({
  workspaceSlug,
  projectId,
  initial,
}: EditProjectDetailsButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    (prev: unknown, formData: FormData) => updateProjectDetailsAction(workspaceSlug, projectId, prev as never, formData),
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
        className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:underline"
      >
        ✎ Edit details
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border-2 border-ink w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="px-5 py-4 border-b-2 border-ink flex items-center justify-between sticky top-0 bg-paper z-10">
          <h2 className="font-black text-lg">Edit project details</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 -mr-1 flex items-center justify-center text-ink hover:bg-cream-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form action={formAction} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={initial.description ?? ''}
              maxLength={4000}
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Street address
            </label>
            <input
              type="text"
              name="address"
              defaultValue={initial.address ?? ''}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                defaultValue={initial.city ?? ''}
                maxLength={120}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                defaultValue={initial.state ?? ''}
                maxLength={40}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                ZIP
              </label>
              <input
                type="text"
                name="zip"
                defaultValue={initial.zip ?? ''}
                maxLength={20}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Start date
              </label>
              <input
                type="date"
                name="startDate"
                defaultValue={initial.startDate ? initial.startDate.toISOString().slice(0, 10) : ''}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                End date
              </label>
              <input
                type="date"
                name="endDate"
                defaultValue={initial.endDate ? initial.endDate.toISOString().slice(0, 10) : ''}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Contract value ($)
              </label>
              <input
                type="number"
                name="contractValue"
                step="0.01"
                min="0"
                defaultValue={initial.contractValue ?? ''}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={initial.status}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          {'error' in (state ?? {}) && state?.error ? (
            <div className="text-[12px] text-error font-extrabold">{state.error}</div>
          ) : null}
          <div className="flex gap-2 pt-2">
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
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}
