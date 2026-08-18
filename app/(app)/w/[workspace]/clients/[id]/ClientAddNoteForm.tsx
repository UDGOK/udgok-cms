'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ClientAddNoteForm({
  clientId,
}: {
  clientId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: body.trim() }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setBody('');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add note');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="px-5 py-4 border-b border-line bg-cream-2">
      <div className="label-eyebrow mb-2">{'// Add a note'}</div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Call notes, follow-ups, decisions…"
        rows={3}
        className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink resize-y"
      />
      {error ? (
        <p className="text-[11px] text-error font-mono mt-2">{error}</p>
      ) : null}
      <div className="flex justify-end mt-3">
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="px-4 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : 'Add note'}
        </button>
      </div>
    </form>
  );
}
