'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createVendorAction, type ActionResult } from '@/lib/procurement/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Creating…' : '+ Create vendor'}
    </button>
  );
}

export function NewVendorForm({
  workspaceId,
  workspaceSlug,
  prefillName,
}: {
  workspaceId: string;
  workspaceSlug: string;
  prefillName: string | null;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const fromQS = search.get('prefill') ?? '';
  const initialName = prefillName ?? fromQS;
  const [open, setOpen] = useState(true);
  // useFormState passes (prevState, formData). createVendorAction
  // wants (workspaceId, prevState, formData). Bind workspaceId so
  // the React runtime doesn't need to know about it.
  const [state, formAction] = useFormState(
    createVendorAction.bind(null, workspaceId) as unknown as (
      prev: ActionResult<{ id: string }> | undefined,
      formData: FormData,
    ) => Promise<ActionResult<{ id: string }>>,
    undefined,
  );

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      router.push(`/w/${workspaceSlug}/procurement/vendors/${state.id}`);
    }
    // workspaceSlug is captured via closure; intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em]"
      >
        + Add vendor
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-paper border-2 border-ink p-5 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Vendor name *">
          <input
            type="text"
            name="name"
            required
            maxLength={200}
            defaultValue={initialName}
            placeholder="e.g. Locke Supply — Broken Arrow"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
          />
          <FieldError field="name" state={state} />
        </Field>
        <Field label="Legal name">
          <input
            type="text"
            name="legalName"
            maxLength={200}
            placeholder="(if different from above)"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
          />
        </Field>
        <Field label="Account # (ours with them)">
          <input
            type="text"
            name="accountNumber"
            maxLength={80}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono"
          />
        </Field>
        <Field label="Capability">
          <select
            name="capability"
            defaultValue="MANUAL"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
          >
            <option value="MANUAL">Manual (rep types prices)</option>
            <option value="QUOTE_LINK">Quote link (vendor-side UI)</option>
            <option value="PUNCHOUT">Punchout (cXML)</option>
            <option value="API">API</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue="ACTIVE"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </Field>
        <Field label="Default terms">
          <input
            type="text"
            name="defaultTerms"
            maxLength={120}
            placeholder="Net 30"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            name="phone"
            maxLength={40}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono"
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            name="website"
            maxLength={200}
            placeholder="https://"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
          />
        </Field>
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
          Address
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Street">
            <input
              type="text"
              name="addressLine1"
              maxLength={200}
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
            />
          </Field>
          <Field label="Street (2)">
            <input
              type="text"
              name="addressLine2"
              maxLength={200}
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
            />
          </Field>
          <Field label="City">
            <input
              type="text"
              name="city"
              maxLength={120}
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="State">
              <input
                type="text"
                name="state"
                maxLength={40}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
              />
            </Field>
            <Field label="ZIP">
              <input
                type="text"
                name="postalCode"
                maxLength={20}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono"
              />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-[12px] text-ink-70">
          <input
            type="checkbox"
            name="taxExempt"
            className="w-4 h-4 border-ink accent-ink"
          />
          Tax-exempt (we won&apos;t bill tax on their invoices)
        </label>
      </div>

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          maxLength={2000}
          rows={3}
          placeholder="Account quirks, rep preferences, will-call hours, etc."
          className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm resize-none"
        />
      </Field>

      {state && !state.ok && state.error && !state.fieldErrors ? (
        <div className="bg-error/10 border border-error p-2 text-[12px] text-error font-semibold">
          ⚠ {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

function FieldError({
  field,
  state,
}: {
  field: string;
  state: ActionResult | undefined;
}) {
  const err = state && !state.ok ? state.fieldErrors?.[field] : undefined;
  if (!err) return null;
  return <div className="text-[10px] text-error mt-0.5 font-semibold">{err}</div>;
}
