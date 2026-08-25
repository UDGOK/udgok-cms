'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field } from '@/components/ui';
import { createDealNoteAction, type CreateNoteState } from '@/lib/notes/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" size="sm" disabled={pending}>
      {pending ? 'Posting…' : 'Post note'}
    </Button>
  );
}

export function AddNoteForm({
  workspaceSlug,
  dealId,
}: {
  workspaceSlug: string;
  dealId: string;
}) {
  const bound = createDealNoteAction.bind(null, workspaceSlug, dealId);
  const [state, formAction] = useFormState<CreateNoteState, FormData>(
    bound,
    undefined,
  );

  const formRef = useRef<HTMLFormElement | null>(null);
  const lastOk = useRef(false);

  // After a successful post, clear the textarea so the next
  // note starts fresh. We track the previous ok state to only
  // clear on a fresh success.
  useEffect(() => {
    if (state?.ok && !lastOk.current) {
      lastOk.current = true;
      if (formRef.current) formRef.current.reset();
    } else if (!state?.ok) {
      lastOk.current = false;
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-t border-line-soft pt-4 mt-2"
    >
      <Field
        label="Add a note"
        htmlFor="deal-note-body"
        error={state?.error}
      >
        <textarea
          id="deal-note-body"
          name="body"
          required
          rows={2}
          placeholder="Logged a call, sent a follow-up, ran a site visit…"
          className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
