'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createWorkspaceAction } from './actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton({ trial }: { trial: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
      {pending
        ? 'Creating…'
        : trial
        ? 'Start my Pro trial →'
        : 'Create workspace →'}
    </Button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useFormState(createWorkspaceAction, undefined);
  const [plan, setPlan] = useState<string | null>(null);

  // Read the plan that /sign-up stored in sessionStorage. We pass it
  // as a hidden form field so the action can stamp the workspace
  // with the right plan + trialEndsAt.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('udgok_signup_plan');
      if (stored === 'pro' || stored === 'enterprise') setPlan(stored);
    } catch {
      // sessionStorage may be unavailable
    }
  }, []);

  const isTrial = plan === 'pro' || plan === 'enterprise';

  return (
    <form action={formAction} className="space-y-4 bg-paper border-2 border-line p-8">
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}

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

      <SubmitButton trial={isTrial} />
    </form>
  );
}
