'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createDealAction } from './actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" disabled={pending}>
      {pending ? 'Creating…' : 'Create deal'}
    </Button>
  );
}

export function NewDealModal({
  workspaceSlug,
  clients,
  onClose,
}: {
  workspaceSlug: string;
  clients: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(createDealAction.bind(null, workspaceSlug), undefined);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label-eyebrow mb-3">{'// New deal'}</div>
        <h2 className="text-2xl font-black mb-6">Add a deal</h2>

        <form action={formAction} className="space-y-4">
          <Field label="Client" htmlFor="clientId" error={state?.fieldErrors?.clientId}>
            <select
              id="clientId"
              name="clientId"
              required
              className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Title" htmlFor="title" error={state?.fieldErrors?.title}>
            <Input id="title" name="title" placeholder="Kitchen remodel" required autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Value (USD)" htmlFor="value" error={state?.fieldErrors?.value}>
              <Input id="value" name="value" type="number" step="0.01" min="0" defaultValue={0} />
            </Field>
            <Field label="Margin (%)" htmlFor="margin" error={state?.fieldErrors?.margin}>
              <Input id="margin" name="margin" type="number" min="0" max="100" step="0.1" />
            </Field>
          </div>

          <Field label="Expected close" htmlFor="expectedClose">
            <Input id="expectedClose" name="expectedClose" type="date" />
          </Field>

          <Field label="Description" htmlFor="description">
            <textarea
              id="description"
              name="description"
              rows={3}
              className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
            />
          </Field>

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
