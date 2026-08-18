'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { createProjectTaskAction } from '@/lib/projects/actions';

interface AddProjectTaskFormProps {
  workspaceSlug: string;
  projectId: string;
  members: { id: string; name: string | null; email: string | null }[];
}

export function AddProjectTaskForm({
  workspaceSlug,
  projectId,
  members,
}: AddProjectTaskFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    (prev: unknown, formData: FormData) => createProjectTaskAction(workspaceSlug, projectId, prev as never, formData),
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
        + New task
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-cream-2 border-2 border-ink p-4 space-y-3"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {'// New task on this project'}
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Title *
        </label>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          placeholder="e.g. Schedule drywall delivery"
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        />
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Notes (optional)
        </label>
        <textarea
          name="description"
          rows={2}
          maxLength={4000}
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Priority
          </label>
          <select
            name="priority"
            defaultValue="NORMAL"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Due date
          </label>
          <input
            type="date"
            name="dueDate"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
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
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            End date
          </label>
          <input
            type="date"
            name="endDate"
            className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Assign to (optional)
        </label>
        <select
          name="assigneeId"
          className="w-full px-3 py-2.5 bg-paper border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.email || 'Unknown'}
            </option>
          ))}
        </select>
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
      {pending ? 'Creating…' : 'Create task'}
    </button>
  );
}
