'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMaterialListAction, type ActionResult } from '@/lib/procurement/list-actions';

export function NewListForm({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [deliverTo, setDeliverTo] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', name);
      if (neededBy) fd.set('neededBy', neededBy);
      if (deliverTo) fd.set('deliverTo', deliverTo);
      if (notes) fd.set('notes', notes);
      const res: ActionResult<{ id: string }> = await createMaterialListAction(
        workspaceId,
        undefined,
        fd,
      );
      if (res.ok) {
        router.push(`/w/${workspaceSlug}/procurement/lists/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-paper border-2 border-ink p-5 space-y-4">
      <label className="block">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
          List name *
        </div>
        <input
          type="text"
          required
          maxLength={200}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Coldstone Creamery — Phase 1 rough-in materials"
          className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
            Needed by (optional)
          </div>
          <input
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono"
          />
        </label>
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
            Deliver to (optional)
          </div>
          <input
            type="text"
            maxLength={200}
            value={deliverTo}
            onChange={(e) => setDeliverTo(e.target.value)}
            placeholder="Job address or shop"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
          />
        </label>
      </div>

      <label className="block">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
          Notes (optional)
        </div>
        <textarea
          maxLength={2000}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Scope summary, exclusions, call-out for the vendor…"
          className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm resize-none"
        />
      </label>

      {error ? (
        <div className="bg-error/10 border border-error p-2 text-[12px] text-error font-semibold">
          ⚠ {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !name}
          className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Creating…' : '+ Create list'}
        </button>
      </div>
    </form>
  );
}
