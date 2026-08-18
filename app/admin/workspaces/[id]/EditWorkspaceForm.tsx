'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { editWorkspaceAction } from '@/lib/admin/actions';

export function EditWorkspaceForm({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: { name: string; slug: string; industry: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(editWorkspaceAction, undefined);

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
        className="px-3 py-1.5 border-2 border-ink text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream"
      >
        ✎ Edit details
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-cream-2 border-2 border-ink p-4 space-y-3"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {'// Edit workspace'}
      </div>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Name
        </label>
        <input
          type="text"
          name="name"
          required
          defaultValue={initial.name}
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        />
        {state?.fieldErrors?.name ? (
          <div className="text-[11px] text-error mt-1">{state.fieldErrors.name}</div>
        ) : null}
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          URL slug
        </label>
        <input
          type="text"
          name="slug"
          required
          defaultValue={initial.slug}
          pattern="[a-z0-9-]+"
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
        />
        {state?.fieldErrors?.slug ? (
          <div className="text-[11px] text-error mt-1">{state.fieldErrors.slug}</div>
        ) : null}
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Industry
        </label>
        <input
          type="text"
          name="industry"
          defaultValue={initial.industry ?? ''}
          placeholder="e.g. General Contractor"
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        />
      </div>
      {state?.error && !state.fieldErrors ? (
        <div className="text-[12px] text-error font-extrabold">{state.error}</div>
      ) : null}
      <div className="flex gap-2">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream"
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
      className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
