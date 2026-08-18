'use client';

import { useTransition } from 'react';
import { deleteProjectAction } from '@/lib/admin/actions';

export function DeleteProjectButton({
  workspaceId,
  projectId,
  projectName,
}: {
  workspaceId: string;
  projectId: string;
  projectName: string;
}) {
  const [pending, start] = useTransition();

  function onClick() {
    if (!confirm(`Delete project "${projectName}"?\n\nThis will permanently delete:\n- All schedule of values\n- All pay apps (and the public share links break)\n- All tasks, messages, photos\n- All sub assignments, contracts, files, notes\n\nThere is no undo.`)) {
      return;
    }
    start(async () => {
      const result = await deleteProjectAction(workspaceId, projectId);
      if (!result.ok) {
        alert(result.error ?? 'Delete failed');
      }
      // revalidatePath on the server refreshes the table
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-error hover:underline disabled:opacity-50"
    >
      {pending ? '…' : 'Delete'}
    </button>
  );
}
