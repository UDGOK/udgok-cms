'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createDivisionAction } from '@/lib/projects/actions';
import { Button, Input, Field } from '@/components/ui';
import { CodePicker } from '@/components/construction/CodePicker';

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
  const [code, setCode] = useState('');
  const [trade, setTrade] = useState('');
  const [subcontractorName, setSubcontractorName] = useState('');
  const [budget, setBudget] = useState('');
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
        // Use our controlled state — the user might have picked a CSI code
        // from the dropdown which only updated React state, not the inputs.
        fd.set('code', code);
        fd.set('trade', trade);
        fd.set('subcontractorName', subcontractorName);
        fd.set('budget', budget);
        const result = (await formAction(fd)) as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;
        if (result?.ok) {
          setOpen(false);
          setCode('');
          setTrade('');
          setSubcontractorName('');
          setBudget('');
        }
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-12 gap-3">
        <CodePicker
          code={code}
          trade={trade}
          onChange={(next) => {
            setCode(next.code);
            setTrade(next.trade);
          }}
          codeError={state?.fieldErrors?.code}
          tradeError={state?.fieldErrors?.trade}
        />

        <div className="col-span-4">
          <Field label="Trade / description" htmlFor="trade">
            <input
              type="text"
              id="trade"
              value={trade}
              onChange={(e) => {
                setTrade(e.target.value);
              }}
              placeholder="e.g. Site prep"
              className={`block w-full px-3.5 py-3 bg-transparent border text-ink text-sm outline-none focus:border-ink ${
                state?.fieldErrors?.trade ? 'border-error' : 'border-line'
              }`}
            />
          </Field>
        </div>

        <div className="col-span-3">
          <Field label="Subcontractor" htmlFor="subcontractorName">
            <Input
              id="subcontractorName"
              value={subcontractorName}
              onChange={(e) => setSubcontractorName(e.target.value)}
              placeholder="Acme Concrete"
            />
          </Field>
        </div>

        <div className="col-span-3">
          <Field label="Budget" htmlFor="budget" error={state?.fieldErrors?.budget}>
            <Input
              id="budget"
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              required
            />
          </Field>
        </div>
      </div>

      {state?.error && !state.fieldErrors ? (
        <p className="text-sm text-error font-semibold">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setCode('');
            setTrade('');
          }}
        >
          Cancel
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
