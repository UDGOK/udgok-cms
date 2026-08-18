'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addProjectMemberAction } from '@/lib/projects/actions';

interface Member {
  id: string;
  name: string | null;
  imageUrl: string | null;
  email: string | null;
}

interface AddProjectMemberFormProps {
  workspaceSlug: string;
  projectId: string;
  members: Member[];
  existingUserIds: string[];
}

export function AddProjectMemberForm({
  workspaceSlug,
  projectId,
  members,
  existingUserIds,
}: AddProjectMemberFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    (prev: unknown, formData: FormData) => addProjectMemberAction(workspaceSlug, projectId, prev as never, formData),
    undefined,
  );

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      setOpen(false);
    }
  }, [state]);

  const available = members.filter((m) => !existingUserIds.includes(m.id));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={available.length === 0}
        className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {available.length === 0 ? 'All members added' : '+ Add teammate'}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-cream-2 border-2 border-ink p-4 space-y-3"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {'// Add teammate to project'}
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Teammate
        </label>
        <select
          name="userId"
          required
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        >
          <option value="">Pick someone…</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.email || 'Unknown'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Role on this project (optional)
        </label>
        <input
          type="text"
          name="role"
          placeholder="e.g. Lead Foreman, Project Manager"
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
      {pending ? 'Adding…' : 'Add to project'}
    </button>
  );
}
