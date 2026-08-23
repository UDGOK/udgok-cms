'use client';

/**
 * The two signature panels + the reject form on the public CO
 * approval page. All three call server actions; none require
 * a Clerk session (the token in the URL is the credential).
 */

import { useState, useTransition } from 'react';
import {
  publicApproveChangeOrderAction,
  publicRejectChangeOrderAction,
} from '@/lib/change-orders/actions';

interface Props {
  token: string;
  ownerSigned: boolean;
  architectSigned: boolean;
}

export function PublicChangeOrderActions({ token, ownerSigned, architectSigned }: Props) {
  return (
    <div className="space-y-6">
      <SignaturePanel
        title="Owner signature"
        role="OWNER"
        token={token}
        disabled={ownerSigned}
        signedHint={ownerSigned ? 'Owner has already signed.' : null}
      />
      <SignaturePanel
        title="Architect signature"
        role="ARCHITECT"
        token={token}
        disabled={architectSigned}
        signedHint={architectSigned ? 'Architect has already signed.' : null}
      />
      <RejectPanel token={token} />
    </div>
  );
}

function SignaturePanel({
  title,
  role,
  token,
  disabled,
  signedHint,
}: {
  title: string;
  role: 'OWNER' | 'ARCHITECT';
  token: string;
  disabled: boolean;
  signedHint: string | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Please type your full name');
      return;
    }
    startTransition(async () => {
      const res = await publicApproveChangeOrderAction({
        token,
        role,
        signatoryName: name,
        signatoryEmail: email || undefined,
      });
      if (!res.ok) setError(res.error);
      // On success, the action revalidates the page; the parent
      // will re-render and disable the panel.
    });
  }

  if (disabled) {
    return (
      <div className="border-2 border-line p-5 bg-success/5">
        <h2 className="font-bold uppercase tracking-wide text-sm mb-1">{title}</h2>
        <p className="text-sm text-success font-semibold">{signedHint}</p>
      </div>
    );
  }

  return (
    <div className="border-2 border-line p-5">
      <h2 className="font-bold uppercase tracking-wide text-sm mb-3">{title}</h2>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="block text-ink-70 mb-1">Full name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border-2 border-line bg-paper"
            placeholder="Type your full name"
            required
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-70 mb-1">Email <span className="text-ink-50">(optional)</span></span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border-2 border-line bg-paper"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>
        {error ? <p className="text-error text-sm">{error}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="px-4 py-2 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50"
        >
          {isPending ? 'Signing…' : `Sign as ${role.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}

function RejectPanel({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!name.trim() || !reason.trim()) {
      setError('Please fill in both fields');
      return;
    }
    startTransition(async () => {
      const res = await publicRejectChangeOrderAction({
        token,
        signatoryName: name,
        reason,
      });
      if (!res.ok) setError(res.error);
    });
  }

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-ink-70 underline"
        >
          Reject this change order instead
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-error p-5 bg-error/5">
      <h2 className="font-bold uppercase tracking-wide text-sm mb-3 text-error">Reject this change order</h2>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="block text-ink-70 mb-1">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border-2 border-line bg-paper"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-70 mb-1">Reason for rejection</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border-2 border-line bg-paper"
            required
            placeholder="Tell us what needs to change before you'll sign."
          />
        </label>
        {error ? <p className="text-error text-sm">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="px-4 py-2 bg-error text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50"
          >
            {isPending ? 'Rejecting…' : 'Reject'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="px-4 py-2 text-ink-70 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
