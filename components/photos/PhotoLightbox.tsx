'use client';

/**
 * PhotoLightbox — full-screen modal for viewing a single
 * project photo. Supports prev/next navigation, an inline
 * edit form, keyboard shortcuts, and a delete handoff.
 *
 * Owns only the `editing` toggle (for swapping the right-hand
 * details panel with the edit form). All other state (which
 * photo is open, which folder it lives in, which other
 * photos to navigate to) lives in the parent.
 *
 * Extracted from ProjectPhotosClient.tsx as part of the
 * Aug 2026 photo-component refactor. The PhotoEditForm
 * itself is in its own file (./PhotoEditForm) so it can
 * be code-split as a separate chunk if needed.
 */

import { useEffect, useState } from 'react';
import { PhotoEditForm } from './PhotoEditForm';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';
import type { PhotoFolder } from './types';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-0.5">
        {label}
      </div>
      <div className="text-[13px] font-bold break-words">{value}</div>
    </div>
  );
}

function PhotoDetailsView({ photo }: { photo: ProjectPhotoListItem }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d mb-2">
        {"// Photo details"}
      </div>
      {photo.caption ? (
        <h2 className="text-2xl font-black leading-tight mb-2">{photo.caption}</h2>
      ) : (
        <h2 className="text-xl font-extrabold text-orange-d italic mb-2">Untitled photo</h2>
      )}
      <div className="text-[10px] font-mono text-ink-50 mb-4">{photo.filename}</div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <DetailField label="Phase" value={photo.phase === 'ROUGH_IN' ? 'Rough-in' : 'Final'} />
        {photo.room ? <DetailField label="Room" value={photo.room} /> : null}
        {photo.area ? <DetailField label="Area" value={photo.area} /> : null}
        {photo.folderName ? <DetailField label="Folder" value={photo.folderName} /> : null}
        {photo.takenAt ? (
          <DetailField label="Taken" value={new Date(photo.takenAt).toLocaleString()} />
        ) : null}
        {photo.latitude ? (
          <DetailField
            label="GPS"
            value={`${photo.latitude.toFixed(4)}, ${photo.longitude?.toFixed(4)}`}
          />
        ) : null}
        <DetailField
          label="Uploaded"
          value={`${photo.uploader.name || photo.uploader.email} · ${new Date(photo.createdAt).toLocaleString()}`}
        />
      </div>

      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
        {"// Tips"}
      </div>
      <ul className="text-[12px] text-ink-70 space-y-1">
        <li>• Press <kbd className="px-1.5 py-0.5 bg-cream-2 border border-line font-mono text-[10px]">←</kbd> / <kbd className="px-1.5 py-0.5 bg-cream-2 border border-line font-mono text-[10px]">→</kbd> to navigate</li>
        <li>• Click <span className="font-extrabold">Edit</span> to rename, change room/folder, or replace the image</li>
        <li>• Click <span className="font-extrabold text-error">Delete</span> to remove this photo</li>
      </ul>
    </div>
  );
}

export function PhotoLightbox({
  photo,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
  onDelete,
  onApplyEdit,
  canEdit,
  workspaceSlug,
  folders,
}: {
  photo: ProjectPhotoListItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  totalCount: number;
  onDelete: () => void;
  onApplyEdit: (id: string, patch: Partial<ProjectPhotoListItem>) => void;
  canEdit: boolean;
  workspaceSlug: string;
  folders: PhotoFolder[];
}) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) setEditing(false);
        else onClose();
      }
      if (e.key === 'ArrowLeft' && !editing) onPrev();
      if (e.key === 'ArrowRight' && !editing) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, editing]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 flex items-center justify-center p-4 md:p-8" onClick={onClose}>
      <div
        className="bg-paper max-w-5xl w-full max-h-[92vh] flex flex-col border-2 border-ink shadow-[8px_8px_0_rgba(255,90,31,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: close + counter + actions — sticky so the
            Edit button is always reachable even when the
            content below is scrolled. */}
        <div className="flex items-center justify-between gap-2 p-3 border-b-2 border-ink bg-cream-2 sticky top-0 z-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            {currentIndex + 1} / {totalCount}
          </div>
          <div className="flex items-center gap-2">
            {canEdit ? (
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                className="px-3 py-1.5 bg-paper border-2 border-ink text-[10px] font-extrabold uppercase tracking-[0.1em] hover:bg-ink hover:text-paper"
              >
                {editing ? 'Close editor' : 'Edit'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 border-2 border-ink hover:bg-ink hover:text-paper text-lg font-bold flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable content area. flex-1 + min-h-0 is the
            critical combo — without min-h-0 the inner details
            panel grows to its content size and the layout
            overlaps (caption sitting on top of the bottom bar).
            min-h-0 lets the flex child shrink so the scroll
            actually triggers. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div
            className={`grid ${
              editing ? 'md:grid-cols-[1fr_1fr]' : 'grid-cols-1'
            }`}
          >
            {/* Photo */}
            <div className="bg-cream-2 flex items-center justify-center p-4 min-h-[300px]">
              <img
                src={photo.url}
                alt={photo.caption || photo.filename}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>

            {/* Details / Editor */}
            <div className="p-5">
              {editing ? (
                <PhotoEditForm
                  photo={photo}
                  workspaceSlug={workspaceSlug}
                  folders={folders}
                  onClose={() => setEditing(false)}
                  onApplied={(patch) => onApplyEdit(photo.id, patch)}
                  onDeleted={onDelete}
                />
              ) : (
                <PhotoDetailsView photo={photo} />
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar: prev / next / delete — sticky so the
            Delete button stays reachable. flex-shrink-0 prevents
            it from being squeezed if the content above is tall. */}
        {totalCount > 1 ? (
          <div className="flex items-center justify-between gap-2 p-3 border-t-2 border-ink bg-cream-2 sticky bottom-0 z-10 flex-shrink-0">
            <button
              type="button"
              onClick={onPrev}
              className="px-4 py-1.5 bg-paper border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-ink hover:text-paper"
            >
              ← Previous
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-1.5 bg-error/10 border-2 border-error text-error text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-error hover:text-paper"
              >
                Delete photo
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={onNext}
              className="px-4 py-1.5 bg-paper border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-ink hover:text-paper"
            >
              Next →
            </button>
          </div>
        ) : canEdit ? (
          <div className="flex items-center justify-end p-3 border-t-2 border-ink bg-cream-2 sticky bottom-0 z-10 flex-shrink-0">
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-1.5 bg-error/10 border-2 border-error text-error text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-error hover:text-paper"
            >
              Delete photo
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
