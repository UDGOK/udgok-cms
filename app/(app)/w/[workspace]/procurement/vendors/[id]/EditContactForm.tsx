'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateContactAction, type ActionResult } from '@/lib/procurement/actions';

/**
 * EditContactForm — pre-filled modal for editing a single
 * vendor contact. Tenant-scoped on the server. The action
 * handles the "isPrimary" demotion: if you tick primary,
 * all other primary contacts for the same vendor are
 * unset first.
 */

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save contact'}
    </button>
  );
}

export interface EditableContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
}

export function EditContactForm({
  workspaceId,
  contact,
  onClose,
}: {
  workspaceId: string;
  contact: EditableContact;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    updateContactAction.bind(null, workspaceId) as unknown as (
      prev: ActionResult | undefined,
      formData: FormData,
    ) => Promise<ActionResult>,
    undefined,
  );

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
              {'// Edit contact'}
            </div>
            <h2 className="text-xl font-black">{contact.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
          >
            ✕ Close
          </button>
        </div>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="contactId" value={contact.id} />

          <Field label="Name *" error={state && !state.ok ? state.fieldErrors?.name : undefined}>
            <input
              type="text"
              name="name"
              required
              maxLength={200}
              defaultValue={contact.name}
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
            />
          </Field>

          <Field label="Email *" error={state && !state.ok ? state.fieldErrors?.email : undefined}>
            <input
              type="email"
              name="email"
              required
              maxLength={200}
              defaultValue={contact.email}
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono outline-none focus:border-ink"
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              name="phone"
              maxLength={40}
              defaultValue={contact.phone ?? ''}
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono outline-none focus:border-ink"
            />
          </Field>

          <Field label="Role / title">
            <input
              type="text"
              name="role"
              maxLength={80}
              defaultValue={contact.role ?? ''}
              placeholder="e.g. Project manager, Estimator"
              className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm outline-none focus:border-ink"
            />
          </Field>

          <label className="flex items-center gap-2 text-[12px] text-ink-70">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={contact.isPrimary}
              className="w-4 h-4 border-ink accent-ink"
            />
            Primary contact (RFQs go here by default)
          </label>

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
