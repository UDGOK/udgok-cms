'use client';

import { useTransition } from 'react';
import { removeProjectMemberAction } from '@/lib/projects/actions';

export function RemoveProjectMemberButton({
  workspaceSlug,
  projectId,
  userId,
  userName,
}: {
  workspaceSlug: string;
  projectId: string;
  userId: string;
  userName: string;
}) {
  const [pending, start] = useTransition();

  function onClick() {
    if (!confirm(`Remove ${userName} from this project?`)) return;
    start(async () => {
      await removeProjectMemberAction(workspaceSlug, projectId, userId);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-50 hover:text-error disabled:opacity-50"
      aria-label={`Remove ${userName}`}
    >
      {pending ? '…' : 'Remove'}
    </button>
  );
}
