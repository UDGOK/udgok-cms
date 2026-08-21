'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateVendorAction, type ActionResult } from '@/lib/procurement/actions';

/**
 * EditVendorForm — pre-filled modal that updates an existing
 * vendor. Same fields as the create form but with defaultValue
 * populated from the vendor record. Tenant-scoped on the
 * server (the action requires the same workspaceId).
 *
 * Click "Edit" on the vendor detail page → modal opens with
 * the current values → user edits → submit → modal closes,
 * the page refreshes via router.refresh().
 */

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

export interface EditableVendor {
  id: string;
  name: string;
  legalName: string | null;
  accountNumber: string | null;
  capability: string;
  status: string;
  defaultTerms: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  taxExempt: boolean;
  notes: string | null;
}

export function EditVendorForm({
  workspaceId,
  vendor,
  onClose,
}: {
  workspaceId: string;
  vendor: EditableVendor;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    updateVendorAction.bind(null, workspaceId, vendor.id) as unknown as (
      prev: ActionResult | undefined,
      formData: FormData,
    ) => Promise<ActionResult>,
    undefined,
  );

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      // Refresh the page so the new values are reflected in
      // the read-only detail view above.
      router.refresh();
      onClose();
    }
    // router + onClose captured by closure; intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
              {'// Edit vendor'}
            </div>
            <h2 className="text-2xl font-black">{vendor.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
          >
            ✕ Close
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Vendor name *" error={state && !state.ok ? state.fieldErrors?.name : undefined}>
              <input
                type="text"
                name="name"
                required
                maxLength={200}
                defaultValue={vendor.name}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
              />
            </Field>
            <Field label="Legal name">
              <input
                type="text"
                name="legalName"
                maxLength={200}
                defaultValue={vendor.legalName ?? ''}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
              />
            </Field>
            <Field label="Account #">
              <input
                type="text"
                name="accountNumber"
                maxLength={80}
                defaultValue={vendor.accountNumber ?? ''}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono outline-none focus:border-ink"
              />
            </Field>
            <Field label="Capability">
              <select
                name="capability"
                defaultValue={vendor.capability}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
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
                defaultValue={vendor.status}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
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
                defaultValue={vendor.defaultTerms ?? ''}
                placeholder="Net 30"
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                name="phone"
                maxLength={40}
                defaultValue={vendor.phone ?? ''}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono outline-none focus:border-ink"
              />
            </Field>
            <Field label="Website">
              <input
                type="url"
                name="website"
                maxLength={200}
                defaultValue={vendor.website ?? ''}
                placeholder="https://"
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
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
                  defaultValue={vendor.addressLine1 ?? ''}
                  className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
                />
              </Field>
              <Field label="Street (2)">
                <input
                  type="text"
                  name="addressLine2"
                  maxLength={200}
                  defaultValue={vendor.addressLine2 ?? ''}
                  className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
                />
              </Field>
              <Field label="City">
                <input
                  type="text"
                  name="city"
                  maxLength={120}
                  defaultValue={vendor.city ?? ''}
                  className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="State">
                  <input
                    type="text"
                    name="state"
                    maxLength={40}
                    defaultValue={vendor.state ?? ''}
                    className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
                  />
                </Field>
                <Field label="ZIP">
                  <input
                    type="text"
                    name="postalCode"
                    maxLength={20}
                    defaultValue={vendor.postalCode ?? ''}
                    className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono outline-none focus:border-ink"
                  />
                </Field>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12px] text-ink-70">
            <input
              type="checkbox"
              name="taxExempt"
              defaultChecked={vendor.taxExempt}
              className="w-4 h-4 border-ink accent-ink"
            />
            Tax-exempt
          </label>

          <Field label="Notes">
            <textarea
              name="notes"
              maxLength={2000}
              rows={3}
              defaultValue={vendor.notes ?? ''}
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink resize-none"
            />
          </Field>

          {state && !state.ok && state.error && !state.fieldErrors ? (
            <div className="bg-error/10 border border-error p-2 text-[12px] text-error font-semibold">
              ⚠ {state.error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
        {label}
      </div>
      {children}
      {error ? (
        <div className="text-[10px] text-error mt-0.5 font-semibold">{error}</div>
      ) : null}
    </label>
  );
}
