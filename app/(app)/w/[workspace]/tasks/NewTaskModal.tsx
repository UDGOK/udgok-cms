'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createTaskAction } from '@/lib/tasks/actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" disabled={pending}>
      {pending ? 'Creating…' : 'Create task'}
    </Button>
  );
}

export function NewTaskModal({
  workspaceSlug,
  team,
  projects,
  clients,
  onClose,
}: {
  workspaceSlug: string;
  team: { id: string; name: string | null }[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(createTaskAction.bind(null, workspaceSlug), undefined);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label-eyebrow mb-3">{'// New task'}</div>
        <h2 className="text-2xl font-black mb-6">Add a task</h2>

        <form action={formAction} className="space-y-4">
          <Field label="Title" htmlFor="title" error={state?.fieldErrors?.title}>
            <Input id="title" name="title" placeholder="Call contractor" required autoFocus />
          </Field>

          <Field label="Description" htmlFor="description">
            <textarea
              id="description"
              name="description"
              rows={3}
              className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority" htmlFor="priority">
              <select
                id="priority"
                name="priority"
                className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
                defaultValue="NORMAL"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </Field>
            <Field label="Due date" htmlFor="dueDate">
              <Input id="dueDate" name="dueDate" type="date" />
            </Field>
          </div>

          <Field label="Assignee" htmlFor="assigneeId">
            <select
              id="assigneeId"
              name="assigneeId"
              className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
            >
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.name ?? 'Unnamed'}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Client" htmlFor="clientId">
              <select
                id="clientId"
                name="clientId"
                className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
              >
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Project" htmlFor="projectId">
              <select
                id="projectId"
                name="projectId"
                className="block w-full px-3.5 py-3 bg-transparent border-line border text-ink text-sm outline-none"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {state?.error && !state.fieldErrors ? (
            <p className="text-sm text-error font-semibold">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
