'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createPropertyAction } from './actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? 'Saving…' : 'Add property'}
    </Button>
  );
}

export function PropertyForm({
  workspaceSlug,
  clientId,
  clientName,
  onDone,
}: {
  workspaceSlug: string;
  clientId: string;
  clientName: string;
  onDone: () => void;
}) {
  const [state, formAction] = useFormState(createPropertyAction.bind(null, workspaceSlug), undefined);

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        if (state?.ok) onDone();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <p className="text-xs text-ink-50">For: <b className="text-ink">{clientName}</b></p>

      <Field label="Label" htmlFor="label" error={state?.fieldErrors?.label}>
        <Input id="label" name="label" placeholder="Main house" required autoFocus />
      </Field>

      <Field label="Address" htmlFor="address" error={state?.fieldErrors?.address}>
        <Input id="address" name="address" required />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="City" htmlFor="city" error={state?.fieldErrors?.city}>
          <Input id="city" name="city" required />
        </Field>
        <Field label="State" htmlFor="state" error={state?.fieldErrors?.state}>
          <Input id="state" name="state" required />
        </Field>
        <Field label="Zip" htmlFor="zip" error={state?.fieldErrors?.zip}>
          <Input id="zip" name="zip" required />
        </Field>
      </div>

      <Field label="Square feet" htmlFor="sqft" error={state?.fieldErrors?.sqft}>
        <Input id="sqft" name="sqft" type="number" min={0} />
      </Field>

      <Field label="Notes" htmlFor="notes" error={state?.fieldErrors?.notes}>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
        />
      </Field>

      {state?.error && !state.fieldErrors ? (
        <p className="text-sm text-error font-semibold">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <SubmitButton />
      </div>
    </form>
  );
}
