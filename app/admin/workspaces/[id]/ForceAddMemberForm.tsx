'use client';

import { useState, useTransition } from 'react';
import { forceAddMemberAction } from '@/lib/admin/actions';

type Role = 'OWNER' | 'ADMIN' | 'PM' | 'ESTIMATOR' | 'FIELD' | 'MEMBER';

export function ForceAddMemberForm({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setMsg(null);
    startTransition(async () => {
      const res = await forceAddMemberAction(workspaceId, email.trim().toLowerCase(), role);
      if (res.ok) {
        setMsg({ kind: 'ok', text: `Added ${email} as ${role}` });
        setEmail('');
      } else {
        setMsg({ kind: 'err', text: res.error ?? 'Failed' });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
          className="flex-1 min-w-0 px-3 py-2 bg-cream border border-line text-[12px]"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="px-2 py-2 bg-cream border border-line text-[11px] font-mono uppercase tracking-[0.05em]"
        >
          <option value="MEMBER">Member</option>
          <option value="FIELD">Field</option>
          <option value="ESTIMATOR">Estimator</option>
          <option value="PM">PM</option>
          <option value="ADMIN">Admin</option>
          <option value="OWNER">Owner</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full px-3 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add to workspace'}
      </button>
      {msg ? (
        <p className={`text-[11px] font-mono ${msg.kind === 'ok' ? 'text-success' : 'text-error'}`}>
          {msg.kind === 'ok' ? '✓' : '⚠'} {msg.text}
        </p>
      ) : null}
    </form>
  );
}
