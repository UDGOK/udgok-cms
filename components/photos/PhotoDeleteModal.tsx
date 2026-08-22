'use client';

/**
 * PhotoDeleteModal — replaces the browser confirm() with a
 * real Atelier-styled dialog. Used by the photo grid +
 * lightbox when the user taps "Delete".
 *
 * Extracted from ProjectPhotosClient.tsx as part of the
 * Aug 2026 photo-component refactor.
 */

import type { ProjectPhotoListItem } from '@/lib/photos/queries';

export function PhotoDeleteModal({
  photo,
  pending,
  onConfirm,
  onCancel,
}: {
  photo: ProjectPhotoListItem;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-ink/85 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-paper max-w-md w-full border-2 border-ink shadow-[8px_8px_0_rgba(200,66,58,0.4)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-error mb-2">
          {'// Delete photo'}
        </div>
        <h3 className="text-xl font-black mb-2">Delete this photo?</h3>
        {photo.caption ? (
          <p className="text-[13px] text-ink-70 mb-1">
            <span className="font-extrabold">{photo.caption}</span>
          </p>
        ) : (
          <p className="text-[13px] text-ink-70 mb-1 italic">This untitled photo</p>
        )}
        <p className="text-[11px] font-mono text-ink-50 mb-4">
          {photo.filename} · uploaded by {photo.uploader.name || photo.uploader.email}
        </p>
        <div className="bg-error/10 border-l-4 border-error p-3 mb-5 text-[12px] text-ink-70">
          This will remove the photo from the project, the activity log, and the PDF project book. The file is deleted from cloud storage. This action cannot be undone.
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 bg-paper border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="px-4 py-2 bg-error text-paper border-2 border-error text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-error/80 disabled:opacity-50"
          >
            {pending ? 'Deleting…' : 'Delete photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
