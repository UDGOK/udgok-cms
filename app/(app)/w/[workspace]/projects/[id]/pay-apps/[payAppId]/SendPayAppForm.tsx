'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendPayAppAction } from '@/lib/pay-apps/actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? 'Sending…' : 'Send pay app'}
    </Button>
  );
}

export function SendPayAppForm({
  workspaceSlug,
  projectId,
  payAppId,
  defaultEmail,
}: {
  workspaceSlug: string;
  projectId: string;
  payAppId: string;
  defaultEmail: string;
}) {
  const [state, formAction] = useFormState(
    sendPayAppAction.bind(null, workspaceSlug, projectId),
    undefined as { error?: string; ok?: boolean } | undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payAppId" value={payAppId} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Send to email" htmlFor="to">
          <Input
            id="to"
            name="to"
            type="email"
            required
            defaultValue={defaultEmail}
            placeholder="client@example.com"
          />
        </Field>
        <Field label="From name" htmlFor="fromName">
          <Input
            id="fromName"
            name="fromName"
            defaultValue="UDGOK Construction"
            placeholder="UDGOK Construction"
          />
        </Field>
      </div>

      {state?.error ? <p className="text-sm text-error font-semibold">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-success font-semibold">Sent! Public link is now live.</p> : null}

      <SubmitButton />
    </form>
  );
}
