'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createClientAction } from './actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" disabled={pending}>
      {pending ? 'Creating…' : 'Create client'}
    </Button>
  );
}

export function NewClientModal({
  workspaceSlug,
  onClose,
}: {
  workspaceSlug: string;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(createClientAction.bind(null, workspaceSlug), undefined);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink w-full max-w-lg p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label-eyebrow mb-3">{'// New client'}</div>
        <h2 className="text-2xl font-black mb-6">Add a new client</h2>

        <form action={formAction} className="space-y-4">
          <Field label="Name" htmlFor="name" error={state?.fieldErrors?.name}>
            <Input id="name" name="name" required autoFocus />
          </Field>
          <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Phone" htmlFor="phone" error={state?.fieldErrors?.phone}>
            <Input id="phone" name="phone" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" htmlFor="type" error={state?.fieldErrors?.type}>
              <select
                id="type"
                name="type"
                className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
                defaultValue="RESIDENTIAL"
              >
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="PROPERTY_MANAGER">Property manager</option>
              </select>
            </Field>
            <Field label="Source" htmlFor="source" error={state?.fieldErrors?.source}>
              <Input id="source" name="source" placeholder="Referral, web, etc." />
            </Field>
          </div>

          {state?.error && !state.fieldErrors ? (
            <p className="text-sm text-error font-semibold">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
