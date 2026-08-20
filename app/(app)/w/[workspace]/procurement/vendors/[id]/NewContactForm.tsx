'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createContactAction, type ActionResult } from '@/lib/procurement/actions';

export function NewContactForm({
  workspaceId,
  vendorId,
  existingCount,
}: {
  workspaceId: string;
  vendorId: string;
  existingCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(existingCount === 0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('vendorId', vendorId);
      fd.set('name', name);
      fd.set('email', email);
      fd.set('phone', phone);
      fd.set('role', role);
      if (isPrimary) fd.set('isPrimary', 'on');
      const res: ActionResult<{ id: string }> = await createContactAction(
        workspaceId,
        undefined,
        fd,
      );
      if (res.ok) {
        setName('');
        setEmail('');
        setPhone('');
        setRole('');
        setIsPrimary(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-cream border border-line text-[11px] font-extrabold uppercase tracking-[0.12em] hover:border-ink"
      >
        + Add contact
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-cream border border-line p-3 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        New contact
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="px-2 py-1.5 bg-paper border border-line text-ink text-[12px]"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="rep@vendor.com"
          className="px-2 py-1.5 bg-paper border border-line text-ink text-[12px] font-mono"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Inside Sales · Pro Desk"
          className="px-2 py-1.5 bg-paper border border-line text-ink text-[12px]"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(918) 555-0123"
          className="px-2 py-1.5 bg-paper border border-line text-ink text-[12px] font-mono"
        />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-ink-70">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="w-3.5 h-3.5 accent-orange"
        />
        Primary contact (RFQs default to this address)
      </label>
      {error ? (
        <div className="text-[11px] text-error font-semibold">⚠ {error}</div>
      ) : null}
      <div className="flex gap-2 justify-end">
        {existingCount > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 border border-line text-[11px] font-extrabold uppercase tracking-[0.12em]"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending || !name || !email}
          className="px-3 py-1.5 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] disabled:opacity-50"
        >
          {pending ? 'Adding…' : '+ Add'}
        </button>
      </div>
    </form>
  );
}
