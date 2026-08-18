'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changeMemberRoleAction, removeMemberAction } from '@/lib/admin/actions';
import type { Role } from '@prisma/client';

const ROLES: { value: Role; label: string }[] = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PM', label: 'PM' },
  { value: 'ESTIMATOR', label: 'Estimator' },
  { value: 'FIELD', label: 'Field' },
  { value: 'MEMBER', label: 'Member' },
];

export function ChangeRoleButton({
  workspaceId,
  userId,
  userName,
  currentRole,
}: {
  workspaceId: string;
  userId: string;
  userName: string;
  currentRole: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function changeRole(role: Role) {
    if (role === currentRole) return;
    start(async () => {
      const result = await changeMemberRoleAction(workspaceId, userId, role);
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Remove ${userName} from this workspace?`)) return;
    start(async () => {
      const result = await removeMemberAction(workspaceId, userId);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentRole}
        onChange={(e) => changeRole(e.target.value as Role)}
        disabled={pending}
        className="text-[10px] font-extrabold uppercase tracking-[0.1em] px-2 py-1 bg-paper border border-ink"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-30 hover:text-error disabled:opacity-50"
      >
        remove
      </button>
    </div>
  );
}
