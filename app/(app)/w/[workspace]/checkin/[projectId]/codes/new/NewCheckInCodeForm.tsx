'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import type { GenerateCodeState } from '@/lib/checkins/actions';

interface NewCheckInCodeFormProps {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  existingLabels: string[];
  action: (
    workspaceSlug: string,
    _prev: GenerateCodeState | undefined,
    formData: FormData,
  ) => Promise<GenerateCodeState>;
}

/**
 * Form for generating a new check-in code. Uses the
 * server action passed in from the page (so the page
 * can colocate the auth + DB lookups) and reacts to
 * the result with a redirect on success.
 */
export function NewCheckInCodeForm({
  workspaceSlug,
  projectId,
  projectName,
  existingLabels,
  action,
}: NewCheckInCodeFormProps) {
  const [state, setState] = useState<GenerateCodeState | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await action(workspaceSlug, state ?? undefined, formData);
      setState(res);
      if (res.ok) {
        router.push(`/w/${workspaceSlug}/checkin/${projectId}`);
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="bg-paper border-2 border-ink p-6"
    >
      <input type="hidden" name="projectId" value={projectId} />

      <label
        htmlFor="label"
        className="block text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50"
      >
        Label
      </label>
      <input
        id="label"
        name="label"
        type="text"
        required
        maxLength={80}
        placeholder="e.g. main gate, shop door, north laydown"
        className="mt-1.5 w-full text-base border-2 border-ink bg-cream px-3 py-2.5"
        autoFocus
      />
      <p className="mt-2 text-[11px] text-ink-70">
        Friendly name for the check-in point. Shown on the
        printed sticker and in the admin list.
      </p>

      {existingLabels.length > 0 ? (
        <div className="mt-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1.5">
            EXISTING LABELS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {existingLabels.map((l) => (
              <span
                key={l}
                className="text-[10px] font-mono uppercase tracking-[0.12em] bg-cream-2 border border-line px-2 py-0.5"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {state && !state.ok ? (
        <div className="mt-4 text-[12px] bg-error/10 border-2 border-error text-error px-3 py-2 font-mono">
          {state.error}
          {state.fieldErrors?.label ? (
            <div className="mt-1 text-[11px]">→ {state.fieldErrors.label}</div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex gap-2 flex-wrap items-center">
        <SubmitButton pending={pending} />
        <Link
          href={`/w/${workspaceSlug}/checkin/${projectId}`}
          className="px-4 py-2.5 bg-paper text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-cream-2"
        >
          Cancel
        </Link>
        <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          For project: {projectName}
        </div>
      </div>
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  // We also use useFormStatus for the pending state
  // when the form submits (e.g. if the user double-
  // clicks). The parent tracks its own pending too,
  // but useFormStatus is the source of truth for
  // "the form is in flight".
  const { pending: formPending } = useFormStatus();
  const isPending = pending || formPending;
  return (
    <button
      type="submit"
      disabled={isPending}
      className="px-4 py-2.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d disabled:opacity-50"
    >
      {isPending ? 'Generating…' : 'Generate QR code'}
    </button>
  );
}
