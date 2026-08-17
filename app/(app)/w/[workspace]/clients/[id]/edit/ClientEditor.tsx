'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Input, Field } from '@/components/ui';
import { updateClientAction, deleteClientAction } from '@/lib/clients/actions';

interface Initial {
  name: string;
  email: string | null;
  phone: string | null;
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'PROPERTY_MANAGER';
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  source: string | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="copper" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>;
}

export function ClientEditor({
  workspaceSlug,
  clientId,
  clientName,
  initial,
}: {
  workspaceSlug: string;
  clientId: string;
  clientName: string;
  initial: Initial;
}) {
  const [state, formAction] = useFormState(
    updateClientAction.bind(null, workspaceSlug, clientId),
    undefined as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  );
  const router = useRouter();

  return (
    <>
      <form className="bg-paper border-2 border-ink p-6 space-y-4" action={formAction}>
        <Field label="Name" htmlFor="c-name" error={state?.fieldErrors?.name}>
          <Input id="c-name" name="name" required defaultValue={initial.name} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" htmlFor="c-email" error={state?.fieldErrors?.email}>
            <Input id="c-email" name="email" type="email" defaultValue={initial.email ?? ''} />
          </Field>
          <Field label="Phone" htmlFor="c-phone">
            <Input id="c-phone" name="phone" defaultValue={initial.phone ?? ''} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Type" htmlFor="c-type">
            <select id="c-type" name="type" defaultValue={initial.type} className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink">
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="PROPERTY_MANAGER">Property manager</option>
            </select>
          </Field>
          <Field label="Status" htmlFor="c-status">
            <select id="c-status" name="status" defaultValue={initial.status} className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <Field label="Source" htmlFor="c-source">
            <Input id="c-source" name="source" defaultValue={initial.source ?? ''} placeholder="Referral, website, etc." />
          </Field>
        </div>

        {state?.error && !state.fieldErrors ? <p className="text-sm text-error font-semibold">{state.error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <SubmitButton />
        </div>
      </form>

      <DeleteClientSection workspaceSlug={workspaceSlug} clientId={clientId} clientName={clientName} />
    </>
  );
}

function DeleteClientSection({ workspaceSlug, clientId, clientName }: { workspaceSlug: string; clientId: string; clientName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  if (!confirming) {
    return (
      <div className="mt-6 bg-paper border-2 border-error/30 p-5">
        <h3 className="font-extrabold text-[14px] mb-1">Danger zone</h3>
        <p className="text-[12px] text-ink-70 mb-3">
          Removing {clientName} will also remove their deals, properties, and notes. Projects linked to this client will be unlinked (not deleted).
        </p>
        <Button variant="ghost" onClick={() => setConfirming(true)} className="text-error border-error/40 hover:bg-error/5">
          Delete client
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-error/5 border-2 border-error p-5">
      <h3 className="font-extrabold text-[14px] text-error mb-1">Are you sure?</h3>
      <p className="text-[12px] text-ink-70 mb-3">
        This permanently removes {clientName} and all related data.
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>Cancel</Button>
        <form
          action={async () => {
            setDeleting(true);
            await deleteClientAction(workspaceSlug, clientId);
            router.push(`/w/${workspaceSlug}/clients`);
          }}
        >
          <Button type="submit" variant="copper" disabled={deleting} className="bg-error border-error text-paper">
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </Button>
        </form>
      </div>
    </div>
  );
}
