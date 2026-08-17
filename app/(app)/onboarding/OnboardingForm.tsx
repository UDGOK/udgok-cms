'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createWorkspaceAction } from './actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
      {pending ? 'Creating…' : 'Create workspace →'}
    </Button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useFormState(createWorkspaceAction, undefined);

  return (
    <form action={formAction} className="space-y-4 bg-paper border-2 border-line p-8">
      <Field label="Workspace name" htmlFor="name">
        <Input id="name" name="name" placeholder="Build Co." required autoFocus />
      </Field>

      <Field label="Industry" htmlFor="industry" hint="optional">
        <Input
          id="industry"
          name="industry"
          placeholder="Construction, Remodel, Design-Build, etc."
        />
      </Field>

      <Field
        label="Invite teammates"
        htmlFor="invites"
        hint="comma or space separated, optional"
      >
        <Input
          id="invites"
          name="invites"
          placeholder="maria@buildco.com, devon@buildco.com"
        />
      </Field>

      {state?.error ? (
        <p className="text-sm text-error font-semibold">{state.error}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
