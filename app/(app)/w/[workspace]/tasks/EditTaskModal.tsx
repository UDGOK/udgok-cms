'use client';

/**
 * EditTaskModal — same fields as NewTaskModal, pre-filled
 * from the existing task. Calls updateTaskAction.
 *
 * The task board exposes "Edit" on every card; clicking it
 * opens this modal. Status changes still go through the
 * column buttons (separate code path, separate action).
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field } from '@/components/ui';
import { updateTaskAction } from '@/lib/tasks/actions';

interface EditableTask {
  id: string;
  title: string;
  description: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string | null; // ISO date (yyyy-mm-dd)
  assigneeId: string | null;
  projectId: string | null;
  clientId: string | null;
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  // Take the yyyy-mm-dd part (input[type=date] format)
  return iso.slice(0, 10);
}

export function EditTaskModal({
  workspaceSlug,
  task,
  team,
  projects,
  clients,
  onClose,
}: {
  workspaceSlug: string;
  task: EditableTask;
  team: { id: string; name: string | null }[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Local form state. We use a controlled form instead of
  // useFormState so we can show per-field validation
  // errors and a single "Save" button.
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(isoToDateInput(task.dueDate));
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const [projectId, setProjectId] = useState(task.projectId ?? '');
  const [clientId, setClientId] = useState(task.clientId ?? '');

  // Reset state if the parent passes a new task (e.g. user
  // edits task A, closes, edits task B — same modal).
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(task.priority);
    setDueDate(isoToDateInput(task.dueDate));
    setAssigneeId(task.assigneeId ?? '');
    setProjectId(task.projectId ?? '');
    setClientId(task.clientId ?? '');
    setError(null);
    setFieldErrors({});
  }, [task.id]);

  async function save() {
    setError(null);
    setFieldErrors({});

    // Inline validation. Same rules as the zod schema in
    // the action — kept in sync by hand.
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (title.length > 200) errs.title = 'Title must be 200 characters or fewer';
    if (description.length > 4000) errs.description = 'Description must be 4000 characters or fewer';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setPending(true);
    try {
      const fd = new FormData();
      fd.set('taskId', task.id);
      fd.set('title', title.trim());
      fd.set('description', description);
      fd.set('priority', priority);
      if (dueDate) fd.set('dueDate', dueDate);
      if (assigneeId) fd.set('assigneeId', assigneeId);
      if (projectId) fd.set('projectId', projectId);
      if (clientId) fd.set('clientId', clientId);

      const res = await updateTaskAction(workspaceSlug, undefined, fd);
      if (res?.ok) {
        // Refresh the page so the board reflects the
        // updated values. Don't navigate away — the modal
        // is on the tasks page, the user expects to stay.
        router.refresh();
        onClose();
      } else if (res?.error) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label-eyebrow mb-3">{'// Edit task'}</div>
        <h2 className="text-2xl font-black mb-6">Edit task</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          <Field label="Title" htmlFor="edit-title" error={fieldErrors.title}>
            <Input
              id="edit-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call contractor"
              required
              autoFocus
            />
          </Field>

          <Field label="Description" htmlFor="edit-description" error={fieldErrors.description}>
            <textarea
              id="edit-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority" htmlFor="edit-priority">
              <select
                id="edit-priority"
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as EditableTask['priority'])}
                className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </Field>
            <Field label="Due date" htmlFor="edit-dueDate">
              <Input
                id="edit-dueDate"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Assignee" htmlFor="edit-assigneeId">
            <select
              id="edit-assigneeId"
              name="assigneeId"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
            >
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? 'Unnamed'}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Client" htmlFor="edit-clientId">
              <select
                id="edit-clientId"
                name="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
              >
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project" htmlFor="edit-projectId">
              <select
                id="edit-projectId"
                name="projectId"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {error ? (
            <p className="text-sm text-error font-semibold">{error}</p>
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="copper" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
