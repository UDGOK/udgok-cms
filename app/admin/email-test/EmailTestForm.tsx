'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendTestEmailAction } from '@/lib/admin/test-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Send test email'}
    </button>
  );
}

export function EmailTestForm() {
  const [state, formAction] = useFormState(sendTestEmailAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Send to
          </label>
          <input
            type="email"
            name="to"
            required
            defaultValue="yasir@udgok.com"
            placeholder="you@example.com"
            className="w-full px-3 py-2 bg-paper border-2 border-line text-[13px]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Subject (optional)
          </label>
          <input
            type="text"
            name="subject"
            placeholder="🧪 UDGOK CMS — Test email"
            maxLength={200}
            className="w-full px-3 py-2 bg-paper border-2 border-line text-[13px]"
          />
        </div>
      </div>

      <SubmitButton />

      {state?.error ? (
        <div className="p-3 bg-error/10 border border-error">
          <div className="text-[11px] font-extrabold text-error mb-1">⚠ Email failed</div>
          <p className="text-[11px] text-ink-70 font-mono break-words">{state.error}</p>
        </div>
      ) : null}

      {state?.ok ? (
        <div className="p-3 bg-success/10 border border-success">
          <div className="text-[11px] font-extrabold text-success mb-1">✓ Email sent</div>
          <p className="text-[11px] text-ink-70 font-mono">
            Message ID: {state.messageId}
            <br />
            From: {state.fromAddress}
            <br />
            Check the recipient&apos;s inbox (and spam folder).
          </p>
        </div>
      ) : null}

      {state?.envCheck ? (
        <details className="text-[10px] font-mono text-ink-50">
          <summary className="cursor-pointer">Environment diagnostic</summary>
          <pre className="mt-2 p-2 bg-cream-2 border border-line overflow-x-auto">
{JSON.stringify(state.envCheck, null, 2)}
          </pre>
        </details>
      ) : null}
    </form>
  );
}
