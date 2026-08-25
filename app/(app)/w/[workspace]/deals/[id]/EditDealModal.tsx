'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Input, Field } from '@/components/ui';
import { updateDealAction, type UpdateDealState } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

interface PropertyRef {
  id: string;
  label: string;
}

interface EditDealModalProps {
  workspaceSlug: string;
  dealId: string;
  initial: {
    title: string;
    value: number;
    margin: number | null;
    expectedClose: string | null; // ISO date string (yyyy-mm-dd) or null
    description: string | null;
    propertyId: string | null;
  };
  properties: PropertyRef[];
  onClose: () => void;
}

/**
 * Edit-deal modal. Pre-fills the form with the current deal
 * values, sends the form via the server action, and closes
 * itself when the action returns `ok: true` (revalidatePath
 * inside the action re-renders the detail page with the new
 * values).
 *
 * State machine:
 *   - idle: nothing submitted yet
 *   - ok=true → close (auto)
 *   - fieldErrors: show inline below each field
 *   - top-level error: show banner at top
 */
export function EditDealModal({
  workspaceSlug,
  dealId,
  initial,
  properties,
  onClose,
}: EditDealModalProps) {
  const bound = updateDealAction.bind(null, workspaceSlug, dealId);
  const [state, formAction] = useFormState<UpdateDealState, FormData>(
    bound,
    undefined,
  );

  // Auto-close on success. The form's transition resolves to a
  // new state with ok:true; we watch that and call onClose.
  const closedRef = useRef(false);
  useEffect(() => {
    if (state?.ok && !closedRef.current) {
      closedRef.current = true;
      onClose();
    }
  }, [state, onClose]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label-eyebrow mb-3">{'// Edit deal'}</div>
        <h2 className="text-2xl font-black mb-6">Edit deal</h2>

        {state?.error ? (
          <div className="mb-4 p-3 bg-error/10 border-2 border-error text-error text-sm">
            {state.error}
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <Field
            label="Title"
            htmlFor="edit-deal-title"
            error={state?.fieldErrors?.title}
          >
            <Input
              id="edit-deal-title"
              name="title"
              required
              defaultValue={initial.title}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Value ($)"
              htmlFor="edit-deal-value"
              error={state?.fieldErrors?.value}
            >
              <Input
                id="edit-deal-value"
                name="value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial.value}
              />
            </Field>
            <Field
              label="Margin (%)"
              htmlFor="edit-deal-margin"
              error={state?.fieldErrors?.margin}
            >
              <Input
                id="edit-deal-margin"
                name="margin"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={initial.margin ?? ''}
              />
            </Field>
          </div>

          <Field
            label="Expected close"
            htmlFor="edit-deal-expectedClose"
            error={state?.fieldErrors?.expectedClose}
          >
            <Input
              id="edit-deal-expectedClose"
              name="expectedClose"
              type="date"
              defaultValue={
                initial.expectedClose
                  ? new Date(initial.expectedClose).toISOString().slice(0, 10)
                  : ''
              }
            />
          </Field>

          {properties.length > 0 ? (
            <Field
              label="Property"
              htmlFor="edit-deal-property"
              error={state?.fieldErrors?.propertyId}
            >
              <select
                id="edit-deal-property"
                name="propertyId"
                defaultValue={initial.propertyId ?? ''}
                className="block w-full px-3.5 py-3 bg-transparent border border-line text-ink text-sm outline-none"
              >
                <option value="">No property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field
            label="Description"
            htmlFor="edit-deal-description"
            error={state?.fieldErrors?.description}
          >
            <textarea
              id="edit-deal-description"
              name="description"
              rows={3}
              defaultValue={initial.description ?? ''}
              className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
            />
          </Field>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
