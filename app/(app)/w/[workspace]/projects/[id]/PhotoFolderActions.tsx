'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deletePhotoFolderAction } from '@/lib/photos/folder-actions';

export function PhotoFolderActions({
  workspaceSlug,
  projectId,
  folderId,
  folderName,
  photoCount,
}: {
  workspaceSlug: string;
  projectId: string;
  folderId: string;
  folderName: string;
  photoCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    start(async () => {
      const result = await deletePhotoFolderAction(workspaceSlug, projectId, folderId);
      if (result.ok) {
        setOpen(false);
        // Navigate to the all-photos view since the folder is gone
        router.push(`/w/${workspaceSlug}/projects/${projectId}/photos`);
        router.refresh();
      } else {
        setError(result.error ?? 'Delete failed');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-30 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Delete ${folderName}`}
      >
        delete
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border-2 border-error w-full max-w-sm">
        <div className="px-5 py-4 border-b-2 border-error bg-error text-paper flex items-center justify-between">
          <h2 className="font-black text-sm">⚠ Delete folder</h2>
          <button type="button" onClick={() => setOpen(false)} className="w-7 h-7 -mr-1 flex items-center justify-center hover:bg-ink">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[14px] text-ink font-extrabold">
            Delete &ldquo;{folderName}&rdquo;?
          </p>
          <p className="text-[12px] text-ink-70">
            {photoCount > 0
              ? `The ${photoCount} photo${photoCount === 1 ? '' : 's'} in this folder will be kept but unfiled (folder will be removed).`
              : 'This folder is empty.'}
          </p>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Type <code className="px-1.5 py-0.5 bg-cream-2 text-ink">{folderName}</code> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-error"
              autoFocus
            />
          </div>
          {error ? <div className="text-[11px] text-error font-extrabold">{error}</div> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending || confirmText !== folderName}
              className="flex-1 px-3 py-2 bg-error text-paper border-2 border-error text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {pending ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
