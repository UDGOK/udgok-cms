'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" size="sm" disabled={pending}>
      {pending ? 'Posting…' : 'Post note'}
    </Button>
  );
}

export function AddNoteForm({
  action,
  placeholder = 'What happened? Next step?',
}: {
  action: (prev: { error?: string; ok?: boolean } | undefined, fd: FormData) => Promise<{ error?: string; ok?: boolean } | undefined>;
  placeholder?: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <textarea
        name="body"
        required
        rows={2}
        placeholder={placeholder}
        className="block w-full px-3 py-2 bg-paper border border-line text-ink text-[13px] outline-none focus:border-ink resize-none"
      />
      <div className="flex items-center justify-between">
        {state?.error ? <span className="text-xs text-error font-semibold">{state.error}</span> : <span />}
        <SubmitButton />
      </div>
    </form>
  );
}
