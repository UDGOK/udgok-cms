'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteUserAction, removeUserFromAllWorkspacesAction } from '@/lib/admin/actions';

export function UserAdminActions({
  userId,
  userName,
  userEmail,
  isMaster,
  isSelf,
  workspaceCount,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  isMaster: boolean;
  isSelf: boolean;
  workspaceCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setConfirmText('');
    setError(null);
  }

  function removeFromAllWorkspaces() {
    if (!confirm(`Remove ${userEmail} from all ${workspaceCount} workspace${workspaceCount === 1 ? '' : 's'}?`)) return;
    start(async () => {
      const result = await removeUserFromAllWorkspacesAction(userId);
      if (result.ok) {
        close();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed');
      }
    });
  }

  function deleteUser() {
    setError(null);
    start(async () => {
      const result = await deleteUserAction(userId);
      if (result.ok) {
        close();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed');
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {workspaceCount > 0 ? (
          <button
            type="button"
            onClick={removeFromAllWorkspaces}
            disabled={isMaster}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] px-2 py-1 border border-ink hover:bg-ink hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed"
            title={isMaster ? 'Cannot remove a master admin' : 'Remove from all workspaces'}
          >
            Kick from all
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={isMaster || isSelf}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] px-2 py-1 border border-error text-error hover:bg-error hover:text-paper disabled:opacity-30 disabled:cursor-not-allowed"
          title={isMaster ? 'Cannot delete a master admin' : isSelf ? 'Cannot delete yourself' : 'Delete user'}
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border-2 border-error w-full max-w-md">
        <div className="px-5 py-4 border-b-2 border-error bg-error text-paper flex items-center justify-between">
          <h2 className="font-black text-lg">⚠ Delete user</h2>
          <button type="button" onClick={close} className="w-8 h-8 -mr-1 flex items-center justify-center hover:bg-ink" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[14px] text-ink font-extrabold">
            Permanently delete {userName || userEmail}?
          </p>
          <p className="text-[13px] text-ink-70">
            Removes them from every workspace, deletes their tasks, messages, uploads, and the local user record. Their Clerk account is left intact — you can delete that separately in the Clerk dashboard.
          </p>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Type <code className="px-1.5 py-0.5 bg-cream-2 text-ink">{userEmail}</code> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-error"
              autoFocus
            />
          </div>
          {error ? (
            <div className="text-[12px] text-error font-extrabold">{error}</div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={deleteUser}
              disabled={pending || confirmText !== userEmail}
              className="flex-1 px-4 py-2.5 bg-error text-paper border-2 border-error text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {pending ? 'Deleting…' : 'Yes, delete user'}
            </button>
            <button
              type="button"
              onClick={close}
              className="px-4 py-2.5 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
