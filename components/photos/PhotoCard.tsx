'use client';

/**
 * PhotoCard — one cell in the project photo grid.
 *
 * Shows the image, the phase badge, the folder badge, and the
 * caption (with click-to-rename when editable). Owns its own
 * "⋮" menu for Edit / Rename / Delete.
 *
 * Pure presentational — the parent (ProjectPhotosClient)
 * owns all state and passes the menu-open + edit-mode +
 * handlers as props. Extracted from ProjectPhotosClient.tsx
 * as part of the Aug 2026 photo-component refactor.
 */

import { PhotoCaptionInline } from './PhotoCaptionInline';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';

export function PhotoCard({
  photo,
  onClick,
  canEdit,
  isEditing,
  onStartRename,
  onCancelRename,
  onSavedRename,
  onApplyEdit,
  menuOpen,
  onToggleMenu,
  onMenuDelete,
  onMenuEdit,
  workspaceSlug,
}: {
  photo: ProjectPhotoListItem;
  onClick: () => void;
  canEdit: boolean;
  isEditing: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSavedRename: () => void;
  onApplyEdit: (id: string, patch: Partial<ProjectPhotoListItem>) => void;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onMenuDelete: () => void;
  onMenuEdit: () => void;
  workspaceSlug: string;
}) {
  return (
    <div
      data-photo-id={photo.id}
      className="bg-paper border-2 border-line overflow-hidden hover:border-ink transition-colors relative group"
    >
      {/* Image area — click opens the lightbox */}
      <div
        className="aspect-square bg-cream-2 relative cursor-pointer"
        onClick={onClick}
      >
        <img
          src={photo.url}
          alt={photo.caption || photo.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Top-left: phase badge */}
        <div
          className={`absolute top-2 left-2 z-10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
            photo.phase === 'ROUGH_IN' ? 'bg-warning text-ink' : 'bg-success text-paper'
          }`}
        >
          {photo.phase === 'ROUGH_IN' ? 'Rough-in' : 'Final'}
        </div>
        {/* Top-right: folder badge (if any) */}
        {photo.folderName ? (
          <div
            className={`absolute top-2 right-2 z-10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
              (photo.folderColor ?? 'ink') === 'orange' ? 'bg-orange text-paper' :
              (photo.folderColor ?? 'ink') === 'ink' ? 'bg-ink text-cream' :
              (photo.folderColor ?? 'ink') === 'success' ? 'bg-success text-paper' :
              (photo.folderColor ?? 'ink') === 'warning' ? 'bg-warning text-ink' :
              (photo.folderColor ?? 'ink') === 'error' ? 'bg-error text-paper' :
              (photo.folderColor ?? 'ink') === 'cream-2' ? 'bg-cream-2 text-ink border border-ink' :
              'bg-ink-30 text-ink'
            }`}
          >
            {photo.folderName}
          </div>
        ) : null}
      </div>

      {/* Footer — caption is the primary label, metadata is secondary */}
      <div className="p-2.5 relative">
        {/* "?" overlay when there's no caption — encourages naming */}
        {!isEditing && !photo.caption && canEdit ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
            className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-orange/90 text-paper text-[10px] font-black rounded-full hover:bg-orange"
            title="Name this photo"
            aria-label="Name this photo"
          >
            ?
          </button>
        ) : null}
        {/* "⋮" menu — only for editable photos */}
        {canEdit ? (
          <div className="absolute top-1.5 right-1.5 z-20">
            <button
              type="button"
              onClick={onToggleMenu}
              className="w-7 h-7 bg-paper/90 hover:bg-ink hover:text-cream border border-line text-[14px] font-extrabold flex items-center justify-center"
              aria-label="Photo actions"
              aria-expanded={menuOpen}
            >
              ⋮
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-8 z-30 w-44 bg-paper border-2 border-ink shadow-[4px_4px_0_var(--ink)]">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMenuEdit(); }}
                  className="block w-full text-left px-3 py-2 text-[12px] font-bold hover:bg-cream-2 border-b border-line"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStartRename(); }}
                  className="block w-full text-left px-3 py-2 text-[12px] font-bold hover:bg-cream-2 border-b border-line"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMenuDelete(); }}
                  className="block w-full text-left px-3 py-2 text-[12px] font-bold text-error hover:bg-error/10"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {isEditing ? (
          <PhotoCaptionInline
            photo={photo}
            workspaceSlug={workspaceSlug}
            onCancel={onCancelRename}
            onSaved={(patch) => {
              onApplyEdit(photo.id, patch);
              onSavedRename();
            }}
          />
        ) : (
          <>
            {/* Caption as the primary label, large and bold */}
            {photo.caption ? (
              <div
                className={`text-[13px] font-extrabold leading-tight line-clamp-2 ${canEdit ? 'cursor-text hover:underline' : ''}`}
                onClick={canEdit ? (e) => { e.stopPropagation(); onStartRename(); } : undefined}
                title={canEdit ? 'Click to rename' : undefined}
              >
                {photo.caption}
              </div>
            ) : (
              <div
                className="text-[12px] font-mono text-orange-d italic cursor-text"
                onClick={canEdit ? (e) => { e.stopPropagation(); onStartRename(); } : undefined}
              >
                untitled — click to name
              </div>
            )}
            {/* Filename as small secondary text */}
            <div className="text-[10px] font-mono text-ink-50 truncate mt-0.5">
              {photo.filename}
            </div>
            {/* Room · area */}
            {photo.room || photo.area ? (
              <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink-70 truncate mt-0.5">
                {[photo.room, photo.area].filter(Boolean).join(' · ')}
              </div>
            ) : null}
            {photo.latitude ? (
              <div className="text-[9px] font-mono text-success mt-0.5">
                📍 {photo.latitude.toFixed(3)}, {photo.longitude?.toFixed(3)}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
