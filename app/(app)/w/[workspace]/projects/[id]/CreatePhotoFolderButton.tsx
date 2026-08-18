'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';
import { createPhotoFolderAction } from '@/lib/photos/folder-actions';

const FOLDER_COLORS = [
  { value: 'orange', label: 'Orange', cls: 'bg-orange' },
  { value: 'ink', label: 'Black', cls: 'bg-ink' },
  { value: 'ink-30', label: 'Gray', cls: 'bg-ink-30' },
  { value: 'success', label: 'Green', cls: 'bg-success' },
  { value: 'warning', label: 'Yellow', cls: 'bg-warning' },
  { value: 'error', label: 'Red', cls: 'bg-error' },
  { value: 'cream-2', label: 'Cream', cls: 'bg-cream-2' },
  { value: 'line', label: 'Light', cls: 'bg-line' },
] as const;

export function CreatePhotoFolderButton({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    (prev: unknown, formData: FormData) =>
      createPhotoFolderAction(workspaceSlug, projectId, prev as never, formData),
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
        className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline flex items-center gap-1"
      >
        + New folder
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
      <form
        action={formAction}
        className="bg-paper border-2 border-ink w-full max-w-md p-5 space-y-3"
      >
        <div className="flex items-center justify-between -mt-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {'// New photo folder'}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-7 h-7 -mr-1 flex items-center justify-center text-ink-50 hover:text-ink hover:bg-cream-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Folder name *
          </label>
          <input
            type="text"
            name="name"
            required
            maxLength={60}
            autoFocus
            placeholder="e.g. Punch List, Foundation, Before"
            className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
          {state?.fieldErrors?.name ? (
            <div className="text-[11px] text-error mt-1">{state.fieldErrors.name}</div>
          ) : null}
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            name="description"
            maxLength={200}
            placeholder="What goes in this folder?"
            className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLORS.map((c) => (
              <label key={c.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={c.value}
                  defaultChecked={c.value === 'orange'}
                  className="peer sr-only"
                />
                <div className={`w-8 h-8 ${c.cls} border-2 border-ink peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-1 flex items-center justify-center`}>
                  <span className="text-[10px] font-black uppercase text-paper mix-blend-difference">{c.label[0]}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {state?.error && !state.fieldErrors ? (
          <div className="text-[12px] text-error font-extrabold">{state.error}</div>
        ) : null}

        <div className="flex gap-2 pt-1">
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
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Creating…' : 'Create folder'}
    </button>
  );
}
