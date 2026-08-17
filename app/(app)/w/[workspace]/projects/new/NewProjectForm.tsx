'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createProjectAction } from '@/lib/projects/actions';
import { Button, Input, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
      {pending ? 'Creating…' : 'Create project'}
    </Button>
  );
}

export function NewProjectForm({
  workspaceSlug,
  clients,
}: {
  workspaceSlug: string;
  clients: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(
    createProjectAction.bind(null, workspaceSlug),
    undefined as { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined,
  );
  const router = useRouter();

  return (
    <form
      action={async (fd) => {
        const result = (await formAction(fd)) as { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined;
        if (result?.id) {
          router.push(`/w/${workspaceSlug}/projects/${result.id}`);
        }
      }}
      className="space-y-4 bg-paper border-2 border-line p-8"
    >
      <Field label="Project name" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" required autoFocus placeholder="123 Main St remodel" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" htmlFor="code" hint="optional" error={state?.fieldErrors?.code}>
          <Input id="code" name="code" placeholder="M-2024-03" />
        </Field>
        <Field label="Client" htmlFor="clientId" error={state?.fieldErrors?.clientId}>
          <select
            id="clientId"
            name="clientId"
            className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Contract value" htmlFor="contractValue" error={state?.fieldErrors?.contractValue}>
        <Input id="contractValue" name="contractValue" type="number" step="0.01" min="0" placeholder="125000" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" />
        </Field>
        <Field label="End date" htmlFor="endDate">
          <Input id="endDate" name="endDate" type="date" />
        </Field>
      </div>

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

      <SubmitButton />
    </form>
  );
}
