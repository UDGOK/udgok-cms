'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendLienWaiverAction } from '@/lib/lien-waivers/actions';

/**
 * Send-to-sub button for a DRAFT lien waiver.
 *
 * One-click "use the sub's contactEmail" path is the default.
 * If the sub has no email, or the user wants to send to a
 * different address, there's an override field.
 *
 * Outcome states the UI needs to handle:
 *   - ok + emailSent: true  — email went out, status is SENT
 *   - ok + emailSent: false — no email on file, status is still
 *     flipped to SENT so the GC can copy the share link
 *     manually
 *   - error:  — show the error, stay on the same page
 */
export function SendToSubButton({
  workspaceSlug,
  projectId,
  waiverId,
  subName,
  subEmail,
}: {
  workspaceSlug: string;
  projectId: string;
  waiverId: string;
  subName: string | null;
  subEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(subEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ emailSent: boolean; recipient: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await sendLienWaiverAction({
        workspaceSlug,
        projectId,
        waiverId,
        recipientEmail: recipientEmail.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess({ emailSent: res.emailSent, recipient: res.recipientEmail });
      // Refresh the page so the status badge + history update
      router.refresh();
    });
  }

  if (success) {
    return (
      <div className="bg-success/10 border-2 border-success p-3 text-sm">
        {success.emailSent ? (
          <>
            ✅ Sent to <strong>{success.recipient}</strong>. The subcontractor
            will get an email with a link to sign.
          </>
        ) : (
          <>
            ⚠️ Status flipped to SENT but no email went out
            {success.recipient ? (
              <> (to <strong>{success.recipient}</strong>)</>
            ) : (
              <> — no email address on file</>
            )}
            . Copy the public link from the sidebar and send it
            manually.
          </>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-ink text-paper text-xs uppercase tracking-wider font-bold hover:bg-ink-90"
      >
        Send to subcontractor
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-paper border-2 border-line p-3 space-y-2 w-full max-w-md">
      <div className="text-[11px] uppercase font-bold tracking-wider text-ink-70">
        Send to {subName ?? 'subcontractor'}
      </div>
      <label className="block text-xs">
        <span className="block text-ink-70 mb-1">Email address</span>
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder={subEmail ?? 'subcontractor@example.com'}
          className="w-full px-2 py-1 border-2 border-line bg-paper text-sm font-mono"
        />
        {subEmail && recipientEmail === subEmail ? (
          <span className="block text-[10px] text-ink-50 mt-1">
            Using {subName ?? 'subcontractor'}&apos;s contact email on file
          </span>
        ) : null}
      </label>
      <p className="text-[10px] text-ink-50 leading-snug">
        Status will flip to SENT immediately. The sub will get an email with a
        link to sign. You can leave this blank to flip the status without
        sending an email — the share link becomes available in the sidebar.
      </p>
      {error ? (
        <div className="text-xs text-error border-2 border-error p-2">{error}</div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 bg-ink text-paper text-xs uppercase tracking-wider font-bold disabled:opacity-50"
        >
          {isPending ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={isPending}
          className="px-3 py-1.5 border-2 border-line text-xs uppercase tracking-wider"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
