'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Input, Field } from '@/components/ui';
import { CodePicker } from '@/components/construction/CodePicker';
import { updateSubcontractorAction, deleteSubcontractorAction } from '@/lib/subs/actions';

interface Initial {
  name: string;
  primaryTrade: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  licenseNumber: string | null;
  insuranceExpiry: string;
  hourlyRate: number | null;
  notes: string | null;
  w9OnFile: boolean;
  rating: number | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

export function SubEditor({
  workspaceSlug,
  subId,
  initial,
}: {
  workspaceSlug: string;
  subId: string;
  initial: Initial;
}) {
  const [code, setCode] = useState(initial.primaryTrade ?? '');
  const [trade, setTrade] = useState('');
  const [state, formAction] = useFormState(
    updateSubcontractorAction.bind(null, workspaceSlug, subId),
    undefined as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  );
  const router = useRouter();

  if (state?.ok) {
    // Hard navigate back to detail
    setTimeout(() => router.push(`/w/${workspaceSlug}/subcontractors/${subId}`), 0);
  }

  return (
    <>
      <form
        action={async (fd) => {
          fd.set('primaryTrade', code);
          await formAction(fd);
        }}
        className="bg-paper border-2 border-ink p-6 space-y-4"
      >
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6">
            <Field label="Company name" htmlFor="s-name" error={state?.fieldErrors?.name}>
              <Input id="s-name" name="name" required defaultValue={initial.name} />
            </Field>
          </div>
          <div className="col-span-3">
            <CodePicker
              code={code}
              trade={trade}
              onChange={(next) => {
                setCode(next.code);
                setTrade(next.trade);
              }}
              codeError={state?.fieldErrors?.primaryTrade}
            />
          </div>
          <div className="col-span-3">
            <Field label="Contact name" htmlFor="s-contact">
              <Input id="s-contact" name="contactName" defaultValue={initial.contactName ?? ''} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Email" htmlFor="s-email" error={state?.fieldErrors?.contactEmail}>
            <Input id="s-email" name="contactEmail" type="email" defaultValue={initial.contactEmail ?? ''} />
          </Field>
          <Field label="Phone" htmlFor="s-phone">
            <Input id="s-phone" name="contactPhone" defaultValue={initial.contactPhone ?? ''} />
          </Field>
          <Field label="Hourly rate" htmlFor="s-rate">
            <Input id="s-rate" name="hourlyRate" type="number" step="0.01" min="0" defaultValue={initial.hourlyRate ?? ''} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="License #" htmlFor="s-lic">
            <Input id="s-lic" name="licenseNumber" defaultValue={initial.licenseNumber ?? ''} />
          </Field>
          <Field label="Insurance expiry" htmlFor="s-ins">
            <Input id="s-ins" name="insuranceExpiry" type="date" defaultValue={initial.insuranceExpiry} />
          </Field>
          <Field label="Quality rating" htmlFor="s-rating">
            <select id="s-rating" name="rating" defaultValue={initial.rating ?? ''} className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink">
              <option value="">—</option>
              <option value="5">★★★★★ (5)</option>
              <option value="4">★★★★☆ (4)</option>
              <option value="3">★★★☆☆ (3)</option>
              <option value="2">★★☆☆☆ (2)</option>
              <option value="1">★☆☆☆☆ (1)</option>
            </select>
          </Field>
        </div>

        <Field label="Address" htmlFor="s-addr">
          <Input id="s-addr" name="address" defaultValue={initial.address ?? ''} />
        </Field>

        <Field label="Notes" htmlFor="s-notes">
          <textarea id="s-notes" name="notes" rows={3} defaultValue={initial.notes ?? ''} className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink" />
        </Field>

        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
          <input type="checkbox" name="w9OnFile" defaultChecked={initial.w9OnFile} className="w-4 h-4 accent-orange" />
          W-9 on file
        </label>

        {state?.error && !state.fieldErrors ? <p className="text-sm text-error font-semibold">{state.error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <SubmitButton />
        </div>
      </form>

      <DeleteSubSection workspaceSlug={workspaceSlug} subId={subId} subName={initial.name} />
    </>
  );
}

function DeleteSubSection({ workspaceSlug, subId, subName }: { workspaceSlug: string; subId: string; subName: string }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  if (!confirming) {
    return (
      <div className="mt-6 bg-paper border-2 border-error/30 p-5">
        <h3 className="font-extrabold text-[14px] mb-1">Danger zone</h3>
        <p className="text-[12px] text-ink-70 mb-3">
          Removing {subName} from your vendor library will detach them from all projects.
          This action cannot be undone.
        </p>
        <Button variant="ghost" onClick={() => setConfirming(true)} className="text-error border-error/40 hover:bg-error/5">
          Remove from library
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-error/5 border-2 border-error p-5">
      <h3 className="font-extrabold text-[14px] text-error mb-1">Are you sure?</h3>
      <p className="text-[12px] text-ink-70 mb-3">
        This permanently removes {subName} and all their project assignments.
      </p>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={deleting}
        >
          Cancel
        </Button>
        <form
          action={async () => {
            setDeleting(true);
            await deleteSubcontractorAction(workspaceSlug, subId);
            router.push(`/w/${workspaceSlug}/subcontractors`);
          }}
        >
          <Button type="submit" variant="copper" disabled={deleting} className="bg-error border-error text-paper">
            {deleting ? 'Removing…' : 'Yes, remove'}
          </Button>
        </form>
      </div>
    </div>
  );
}
