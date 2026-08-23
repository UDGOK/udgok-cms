'use client';

import { useState, useTransition } from 'react';
import { publicSignLienWaiverAction } from '@/lib/lien-waivers/actions';

export function PublicLienWaiverActions({ token }: { token: string }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [exceptions, setExceptions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [agreed, setAgreed] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please type your full legal name');
      return;
    }
    if (!agreed) {
      setError('You must check the agreement box');
      return;
    }
    startTransition(async () => {
      const res = await publicSignLienWaiverAction({
        token,
        signerName: name,
        signerTitle: title || null,
        signerEmail: email || null,
        exceptionText: exceptions.trim() || null,
      });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="border-2 border-line p-5 space-y-4">
      <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em]">Sign this waiver</h2>
      <p className="text-sm text-ink-70">
        By signing below, you accept the terms above and release the listed
        lien rights to the extent described. This is a legally binding waiver.
      </p>
      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Full legal name <span className="text-error">*</span></span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
          required
          autoComplete="name"
        />
      </label>
      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Title / role</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
          placeholder="e.g. President, Owner"
        />
      </label>
      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Email <span className="text-ink-50">(optional, for confirmation)</span></span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
          autoComplete="email"
        />
      </label>
      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Exceptions or reservations <span className="text-ink-50">(optional)</span></span>
        <textarea
          value={exceptions}
          onChange={(e) => setExceptions(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
          placeholder="e.g. Except for retainage of $5,000 not yet released."
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1"
        />
        <span>
          I have read the waiver terms above and typed my name as my electronic signature.
        </span>
      </label>
      {error ? <p className="text-error text-sm">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50"
      >
        {isPending ? 'Signing…' : 'Sign waiver'}
      </button>
    </form>
  );
}
