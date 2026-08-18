'use client';

import { useState, useTransition } from 'react';
import { deleteWorkspaceAction } from '@/lib/admin/actions';

export function DeleteWorkspaceButton({
  workspaceId,
  workspaceName,
  memberCount,
  projectCount,
}: {
  workspaceId: string;
  workspaceName: string;
  memberCount: number;
  projectCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    setConfirmText(''); // reset so they can't double-click
    start(async () => {
      const result = await deleteWorkspaceAction(workspaceId);
      if (!result.ok) {
        setError(result.error ?? 'Delete failed');
        setOpen(false);
        return;
      }
      // Hard navigation — always works, even if the next page errors
      window.location.href = '/admin/workspaces';
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error hover:text-paper"
      >
        🗑 Delete workspace
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border-2 border-error w-full max-w-md">
        <div className="px-5 py-4 border-b-2 border-error bg-error text-paper flex items-center justify-between">
          <h2 className="font-black text-lg">⚠ Delete workspace</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 -mr-1 flex items-center justify-center hover:bg-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-orange text-paper px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] mb-1">
            👑 You are a platform master admin — you have full owner rights
          </div>
          <p className="text-[14px] text-ink font-extrabold">
            This will permanently delete &ldquo;{workspaceName}&rdquo; and ALL of its data.
          </p>
          <div className="text-[12px] text-ink-70 space-y-1">
            <p>
              • <b>{memberCount} member{memberCount === 1 ? '' : 's'}</b> — their workspace access is removed (their accounts stay)
            </p>
            <p>
              • <b>{projectCount} project{projectCount === 1 ? '' : 's'}</b> — every project, pay app, photo, task, note, file, sub, and permit is wiped
            </p>
            <p className="text-error font-extrabold">• There is absolutely NO undo. This is permanent.</p>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Type <code className="px-1.5 py-0.5 bg-cream-2 text-ink">{workspaceName}</code> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-error"
              autoFocus
              placeholder={workspaceName}
            />
          </div>
          {error ? (
            <div className="bg-error/10 border border-error text-error px-3 py-2 text-[12px] font-extrabold">
              ✕ {error}
            </div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending || confirmText !== workspaceName}
              className="flex-1 px-4 py-2.5 bg-error text-paper border-2 border-error text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {pending ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
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
