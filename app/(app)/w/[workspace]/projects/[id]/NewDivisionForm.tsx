'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createDivisionAction } from '@/lib/projects/actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" size="sm" disabled={pending}>
      {pending ? 'Adding…' : '+ Add division'}
    </Button>
  );
}

export function NewDivisionForm({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    createDivisionAction.bind(null, workspaceSlug, projectId),
    undefined as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  );

  if (!open) {
    return (
      <Button variant="copper" size="sm" onClick={() => setOpen(true)}>
        + Add division
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        const result = (await formAction(fd)) as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;
        if (result?.ok) setOpen(false);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-2">
          <Field label="Code" htmlFor="code" error={state?.fieldErrors?.code}>
            <Input id="code" name="code" placeholder="01" required />
          </Field>
        </div>
        <div className="col-span-4">
          <Field label="Trade / description" htmlFor="trade" error={state?.fieldErrors?.trade}>
            <Input id="trade" name="trade" placeholder="Site prep" required />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Subcontractor" htmlFor="subcontractorName">
            <Input id="subcontractorName" name="subcontractorName" placeholder="Acme Concrete" />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Budget" htmlFor="budget" error={state?.fieldErrors?.budget}>
            <Input id="budget" name="budget" type="number" step="0.01" min="0" required />
          </Field>
        </div>
      </div>
      {state?.error && !state.fieldErrors ? (
        <p className="text-sm text-error font-semibold">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <SubmitButton />
      </div>
    </form>
  );
}
