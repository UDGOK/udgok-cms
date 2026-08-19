'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';
import type { PhotoPhase } from '@prisma/client';
import { GeoPhotoCapture } from '@/components/files/GeoPhotoCapture';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  uploadProjectPhotoAction,
  deleteProjectPhotoAction,
  updateProjectPhotoAction,
} from '@/lib/photos/actions';
import { PhotoFolderTabs } from '@/app/(app)/w/[workspace]/projects/[id]/PhotoFolderTabs';
import { compressImage } from '@/lib/images/compress';

export interface PhotoFolder {
  id: string;
  name: string;
  color: string;
  description: string | null;
  _count: { photos: number };
}

interface ProjectPhotosClientProps {
  workspaceSlug: string;
  projectId: string;
  initialPhotos: ProjectPhotoListItem[];
  initialFacets: { rooms: string[]; areas: string[]; roughInCount: number; finalCount: number };
  initialFolders: PhotoFolder[];
  activeFolderId: string | null;
  /** ID of the signed-in user. Photo is editable/deletable if they uploaded it. */
  currentUserId: string;
  /** Master admins can edit/delete any photo in their workspaces. */
  canDeleteAny: boolean;
}

/**
 * Can the current user edit/delete a given photo? Photos are
 * editable by their uploader, or by workspace OWNER/ADMIN.
 */
function userCanEdit(
  photo: ProjectPhotoListItem,
  currentUserId: string,
  canDeleteAny: boolean,
): boolean {
  return canDeleteAny || photo.uploaderId === currentUserId;
}

function UploadButton({ compressing = false }: { compressing?: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || compressing;
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full px-4 py-3 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-50"
    >
      {compressing ? 'Compressing…' : pending ? 'Uploading…' : 'Upload photo'}
    </button>
  );
}

export function ProjectPhotosClient({
  workspaceSlug,
  projectId,
  initialPhotos,
  initialFacets,
  initialFolders,
  activeFolderId,
  currentUserId,
  canDeleteAny,
}: ProjectPhotosClientProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [filterPhase, setFilterPhase] = useState<PhotoPhase | 'ALL'>('ALL');
  const [filterRoom, setFilterRoom] = useState<string>('');
  const [filterArea, setFilterArea] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightbox, setLightbox] = useState<ProjectPhotoListItem | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [photoMenuId, setPhotoMenuId] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<ProjectPhotoListItem | null>(null);
  const [pendingDeleteId, startDelete] = useTransition();
  const [uploadState, uploadFormAction] = useFormState(
    uploadProjectPhotoAction.bind(null, workspaceSlug),
    undefined,
  );

  // Close the sheet when upload succeeds. Must be useEffect, not
  // useState — the latter only runs the body once on mount when
  // uploadState is still `undefined`, so the sheet would never
  // close after a successful upload.
  useEffect(() => {
    if (uploadState?.ok) {
      setSheetOpen(false);
      router.refresh();
    }
  }, [uploadState, router]);

  // Close the photo menu when clicking outside.
  useEffect(() => {
    if (!photoMenuId) return;
    const handler = () => setPhotoMenuId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [photoMenuId]);

  async function handleGeophotoUpload(file: File, meta: { latitude?: number; longitude?: number; takenAt?: Date }) {
    const compressed = await compressImage(file);
    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('file', compressed);
    fd.set('phase', 'ROUGH_IN');
    if (meta.latitude) fd.set('latitude', String(meta.latitude));
    if (meta.longitude) fd.set('longitude', String(meta.longitude));
    if (meta.takenAt) fd.set('takenAt', meta.takenAt.toISOString());
    const res = await uploadProjectPhotoAction(workspaceSlug, undefined, fd);
    if (res?.ok) {
      setSheetOpen(false);
      router.refresh();
    } else {
      alert(res?.error ?? 'Upload failed');
    }
  }

  function handleDeleteRequest(photo: ProjectPhotoListItem) {
    setPhotoMenuId(null);
    setLightbox(null);
    setDeletingPhoto(photo);
  }

  function handleDeleteConfirm() {
    if (!deletingPhoto) return;
    const photoId = deletingPhoto.id;
    setDeletingPhoto(null);
    startDelete(async () => {
      const res = await deleteProjectPhotoAction(workspaceSlug, photoId);
      if (res.ok) {
        setPhotos((p) => p.filter((x) => x.id !== photoId));
        if (lightbox?.id === photoId) setLightbox(null);
        router.refresh();
      } else {
        alert(res.error ?? 'Delete failed');
      }
    });
  }

  /**
   * Optimistically apply an edit to a photo (caption, room, area,
   * phase, folder, url). Rolls back on error.
   */
  function applyPhotoEdit(photoId: string, patch: Partial<ProjectPhotoListItem>) {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, ...patch } : p)));
    if (lightbox?.id === photoId) {
      setLightbox((lb) => (lb ? { ...lb, ...patch } : lb));
    }
  }

  const filtered = photos.filter((p) => {
    if (filterPhase !== 'ALL' && p.phase !== filterPhase) return false;
    if (filterRoom && p.room !== filterRoom) return false;
    if (filterArea && p.area !== filterArea) return false;
    return true;
  });

  return (
    <div>
      <PhotoFolderTabs
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        folders={initialFolders}
        activeFolderId={activeFolderId}
        totalPhotos={initialFacets.roughInCount + initialFacets.finalCount}
      />

      {/* Header bar with phase toggle + filters + add button */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="inline-flex border-2 border-ink">
          {(['ALL', 'ROUGH_IN', 'FINAL'] as const).map((phase) => {
            const isActive = filterPhase === phase;
            const label = phase === 'ALL' ? 'All' : phase === 'ROUGH_IN' ? 'Rough-in' : 'Final';
            return (
              <button
                key={phase}
                type="button"
                onClick={() => setFilterPhase(phase)}
                className={`px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-colors ${
                  isActive
                    ? 'bg-ink text-cream'
                    : phase === 'ROUGH_IN'
                    ? 'bg-warning/30 text-ink hover:bg-warning/50'
                    : phase === 'FINAL'
                    ? 'bg-success/30 text-ink hover:bg-success/50'
                    : 'bg-paper text-ink-70 hover:bg-cream-2'
                }`}
              >
                {label}
                {phase === 'ROUGH_IN' && ` (${initialFacets.roughInCount})`}
                {phase === 'FINAL' && ` (${initialFacets.finalCount})`}
              </button>
            );
          })}
        </div>

        {initialFacets.rooms.length > 0 ? (
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="px-3 py-2 bg-paper border-2 border-line text-[12px] font-mono uppercase tracking-[0.05em]"
          >
            <option value="">All rooms</option>
            {initialFacets.rooms.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : null}

        {initialFacets.areas.length > 0 ? (
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="px-3 py-2 bg-paper border-2 border-line text-[12px] font-mono uppercase tracking-[0.05em]"
          >
            <option value="">All areas</option>
            {initialFacets.areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        ) : null}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d"
        >
          + Add photo
        </button>
      </div>

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <div className="border-2 border-dashed border-line p-12 text-center bg-cream-2">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-[13px] text-ink-70">
            {photos.length === 0
              ? 'No photos yet. Take a rough-in or final photo to start documenting this project.'
              : 'No photos match your filters. Try clearing the room/area filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              onClick={() => setLightbox(p)}
              canEdit={userCanEdit(p, currentUserId, canDeleteAny)}
              isEditing={editingPhotoId === p.id}
              onStartRename={() => setEditingPhotoId(p.id)}
              onCancelRename={() => setEditingPhotoId(null)}
              onSavedRename={() => setEditingPhotoId(null)}
              onApplyEdit={applyPhotoEdit}
              menuOpen={photoMenuId === p.id}
              onToggleMenu={(e) => {
                e.stopPropagation();
                setPhotoMenuId(photoMenuId === p.id ? null : p.id);
              }}
              onMenuDelete={() => handleDeleteRequest(p)}
              onMenuEdit={() => {
                setPhotoMenuId(null);
                setLightbox(p);
              }}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              folders={initialFolders}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox ? (
        <Lightbox
          photo={lightbox}
          currentIndex={filtered.findIndex((p) => p.id === lightbox.id)}
          totalCount={filtered.length}
          onClose={() => setLightbox(null)}
          onPrev={() => {
            const idx = filtered.findIndex((p) => p.id === lightbox.id);
            const prev = idx === 0 ? filtered.length - 1 : idx - 1;
            setLightbox(filtered[prev]);
          }}
          onNext={() => {
            const idx = filtered.findIndex((p) => p.id === lightbox.id);
            const next = idx === filtered.length - 1 ? 0 : idx + 1;
            setLightbox(filtered[next]);
          }}
          onDelete={() => handleDeleteRequest(lightbox)}
          onApplyEdit={applyPhotoEdit}
          canEdit={userCanEdit(lightbox, currentUserId, canDeleteAny)}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          folders={initialFolders}
        />
      ) : null}

      {/* Delete confirmation modal */}
      {deletingPhoto ? (
        <DeleteConfirmModal
          photo={deletingPhoto}
          pending={pendingDeleteId}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingPhoto(null)}
        />
      ) : null}

      {/* Mobile upload sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add project photo" maxHeightClass="max-h-[92vh]">
        <PhotoUploadForm
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          initialFolders={initialFolders}
          activeFolderId={activeFolderId}
          uploadFormAction={uploadFormAction}
          uploadState={uploadState}
          onGeoCapture={handleGeophotoUpload}
        />
      </BottomSheet>
    </div>
  );
}

// ============================================================
// PhotoCard — caption is the primary label, click-to-rename inline
// ============================================================
function PhotoCard({
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
  projectId,
  folders,
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
  projectId: string;
  folders: PhotoFolder[];
}) {
  return (
    <div
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
          <InlineRenameInput
            photo={photo}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            folders={folders}
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

// ============================================================
// InlineRenameInput — click caption to rename, Enter to save, Esc to cancel
// ============================================================
function InlineRenameInput({
  photo,
  workspaceSlug,
  onCancel,
  onSaved,
}: {
  photo: ProjectPhotoListItem;
  workspaceSlug: string;
  projectId: string;
  folders: PhotoFolder[];
  onCancel: () => void;
  onSaved: (patch: Partial<ProjectPhotoListItem>) => void;
}) {
  const [value, setValue] = useState(photo.caption ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function save() {
    const trimmed = value.trim();
    // No change → just close.
    if (trimmed === (photo.caption ?? '')) {
      onCancel();
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set('photoId', photo.id);
    fd.set('caption', trimmed);
    const res = await updateProjectPhotoAction(workspaceSlug, undefined, fd);
    setSaving(false);
    if (res && 'ok' in res && res.ok) {
      onSaved({ caption: trimmed || null });
    } else {
      // eslint-disable-next-line no-console
      console.error('[photos] rename failed', res);
      alert('Rename failed');
      onCancel();
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        placeholder="Name this photo…"
        maxLength={500}
        className="flex-1 px-2 py-1 text-[12px] font-extrabold bg-paper border-2 border-orange focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); save(); }}
        disabled={saving}
        className="px-2 py-1 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.05em] disabled:opacity-50"
        title="Save (Enter)"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        disabled={saving}
        className="px-2 py-1 bg-paper border border-line text-ink text-[10px] font-extrabold uppercase tracking-[0.05em] disabled:opacity-50"
        title="Cancel (Esc)"
      >
        ×
      </button>
    </div>
  );
}

// ============================================================
// Lightbox — full preview with Edit panel
// ============================================================
function Lightbox({
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
  projectId: string;
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

// ============================================================
// PhotoDetailsView — the read-only "details" panel inside the lightbox
// ============================================================
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

// ============================================================
// PhotoEditForm — the edit panel inside the lightbox
// ============================================================
function PhotoEditForm({
  photo,
  workspaceSlug,
  folders,
  onClose,
  onApplied,
  onDeleted,
}: {
  photo: ProjectPhotoListItem;
  workspaceSlug: string;
  folders: PhotoFolder[];
  onClose: () => void;
  onApplied: (patch: Partial<ProjectPhotoListItem>) => void;
  onDeleted: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [room, setRoom] = useState(photo.room ?? '');
  const [area, setArea] = useState(photo.area ?? '');
  const [phase, setPhase] = useState<PhotoPhase>(photo.phase);
  const [folderId, setFolderId] = useState(photo.folderId ?? '');
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacePreview, setReplacePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Build a preview URL when the user picks a replacement file.
  useEffect(() => {
    if (!replaceFile) {
      setReplacePreview(null);
      return;
    }
    const url = URL.createObjectURL(replaceFile);
    setReplacePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [replaceFile]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set('photoId', photo.id);
      if (caption.trim() !== (photo.caption ?? '')) {
        fd.set('caption', caption.trim());
      }
      if (room.trim() !== (photo.room ?? '')) {
        fd.set('room', room.trim());
      }
      if (area.trim() !== (photo.area ?? '')) {
        fd.set('area', area.trim());
      }
      if (phase !== photo.phase) {
        fd.set('phase', phase);
      }
      if ((folderId || null) !== (photo.folderId || null)) {
        fd.set('folderId', folderId || '');
      }
      if (replaceFile) {
        // Compress before sending — phone photos can be 5-10 MB.
        const compressed = await compressImage(replaceFile);
        fd.set(
          'file',
          compressed,
          replaceFile.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg'),
        );
      }
      const res = await updateProjectPhotoAction(workspaceSlug, undefined, fd);
      if (res && 'ok' in res && res.ok) {
        onApplied({
          caption: caption.trim() || null,
          room: room.trim() || null,
          area: area.trim() || null,
          phase,
          folderId: folderId || null,
          folderName: folders.find((f) => f.id === folderId)?.name ?? null,
          folderColor: folders.find((f) => f.id === folderId)?.color ?? null,
          ...(res.photo.url !== photo.url ? { url: res.photo.url, filename: res.photo.filename } : {}),
        });
        onClose();
      } else {
        alert((res && 'error' in res && res.error) ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    caption.trim() !== (photo.caption ?? '') ||
    room.trim() !== (photo.room ?? '') ||
    area.trim() !== (photo.area ?? '') ||
    phase !== photo.phase ||
    (folderId || null) !== (photo.folderId || null) ||
    replaceFile !== null;

  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d mb-3">
        {"// Edit photo"}
      </div>

      {/* Replace image preview */}
      {replacePreview ? (
        <div className="mb-3 border-2 border-orange p-2">
          <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-orange-d mb-1.5">
            New image preview
          </div>
          <img src={replacePreview} alt="Replace preview" className="w-full max-h-48 object-contain bg-cream-2" />
        </div>
      ) : null}

      <div className="space-y-3">
        {/* Caption */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Caption / name
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
            placeholder="Master Bath Rough-In, Kitchen Tile, Front Elevation…"
            className="w-full px-3 py-2 bg-paper border-2 border-line text-[14px] font-bold focus:border-ink focus:outline-none"
          />
        </div>

        {/* Room + Area */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
              Room
            </label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              maxLength={80}
              placeholder="Kitchen, Master Bath…"
              className="w-full px-3 py-2 bg-paper border-2 border-line text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
              Area
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              maxLength={80}
              placeholder="North wing, Floor 2…"
              className="w-full px-3 py-2 bg-paper border-2 border-line text-[13px]"
            />
          </div>
        </div>

        {/* Phase */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Phase
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['ROUGH_IN', 'FINAL'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                className={`px-3 py-2 border-2 text-[12px] font-extrabold uppercase tracking-[0.05em] transition-colors ${
                  phase === p
                    ? p === 'ROUGH_IN'
                      ? 'bg-warning border-warning text-ink'
                      : 'bg-success border-success text-paper'
                    : 'bg-paper border-line text-ink-70 hover:bg-cream-2'
                }`}
              >
                {p === 'ROUGH_IN' ? 'Rough-in' : 'Final'}
              </button>
            ))}
          </div>
        </div>

        {/* Folder */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Folder
          </label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full px-3 py-2 bg-paper border-2 border-line text-[13px] font-extrabold"
          >
            <option value="">No folder (unfiled)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Replace image */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Replace image
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setReplaceFile(f);
            }}
            className="block w-full text-[12px] file:mr-3 file:py-1.5 file:px-3 file:border-2 file:border-ink file:bg-paper file:font-extrabold file:text-[10px] file:uppercase file:tracking-[0.1em] file:cursor-pointer"
          />
          <p className="text-[10px] font-mono text-ink-50 mt-1">
            {replaceFile
              ? `New file: ${replaceFile.name} (${(replaceFile.size / 1024 / 1024).toFixed(1)} MB — auto-compressed)`
              : 'Upload a new image file. Caption, room, area, phase, and folder are preserved.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t-2 border-line">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.1em] disabled:opacity-40 hover:bg-orange-d"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-paper border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-ink hover:text-paper"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onDeleted}
            disabled={saving}
            className="px-3 py-2 text-error hover:bg-error/10 text-[10px] font-extrabold uppercase tracking-[0.1em]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DeleteConfirmModal — replaces the browser confirm() with a real dialog
// ============================================================
function DeleteConfirmModal({
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

// ============================================================
// PhotoUploadForm (unchanged from prior version — kept here so the
// sheet component reference still resolves)
// ============================================================
function PhotoUploadForm({
  projectId,
  initialFolders,
  activeFolderId,
  uploadFormAction,
  uploadState,
  onGeoCapture,
}: {
  workspaceSlug?: string;
  projectId: string;
  initialFolders: PhotoFolder[];
  activeFolderId: string | null;
  uploadFormAction: (formData: FormData) => void;
  uploadState: { error?: string; ok?: boolean; id?: string } | undefined;
  onGeoCapture: (file: File, meta: { latitude?: number; longitude?: number; takenAt?: Date }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [compressing, setCompressing] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = fileInputRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      const fd = new FormData(form);
      uploadFormAction(fd);
      return;
    }
    setCompressing(true);
    try {
      const file = fileInput.files[0];
      const compressed = await compressImage(file);
      const fd = new FormData();
      const formData = new FormData(form);
      formData.delete('file');
      Array.from(formData.entries()).forEach(([k, v]) => {
        fd.append(k, v);
      });
      fd.set('file', compressed, file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg'));
      uploadFormAction(fd);
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-cream-2 border border-line">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-2">
          Take a GPS-tagged photo
        </div>
        <GeoPhotoCapture onCapture={onGeoCapture} label="Open camera" />
      </div>

      <div className="text-center text-[10px] font-mono uppercase tracking-[0.1em] text-ink-30">— or —</div>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Photo file
          </label>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept="image/*"
            required
            className="block w-full px-3 py-2 bg-paper border border-line text-[12px] file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-ink file:text-cream file:font-extrabold file:uppercase file:tracking-[0.1em] file:text-[10px]"
          />
          <p className="text-[10px] font-mono text-ink-30 uppercase tracking-[0.1em] mt-1">
            Phone photos auto-compressed to fit upload limit
          </p>
        </div>

        {/* Caption is now the FIRST field after the file picker */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Caption / name
          </label>
          <input
            type="text"
            name="caption"
            placeholder="Master Bath Rough-In, Kitchen Tile…"
            maxLength={500}
            className="w-full px-3 py-2 bg-paper border-2 border-line text-[14px] font-bold focus:border-ink focus:outline-none"
          />
          <p className="text-[10px] font-mono text-ink-50 mt-1">
            A clear name makes the project book and gallery 10× more useful
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
              Folder
            </label>
            <select
              name="folderId"
              defaultValue={activeFolderId ?? ''}
              className="w-full px-3 py-2 bg-paper border border-line text-[12px] font-extrabold"
            >
              <option value="">No folder (unfiled)</option>
              {initialFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
              Room
            </label>
            <input
              type="text"
              name="room"
              placeholder="Kitchen, Master Bath…"
              maxLength={80}
              className="w-full px-3 py-2 bg-paper border border-line text-[12px]"
            />
          </div>
        </div>
        <div className="mt-2">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
              Area
            </label>
            <input
              type="text"
              name="area"
              placeholder="North wing, Floor 2…"
              maxLength={80}
              className="w-full px-3 py-2 bg-paper border border-line text-[12px]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Phase
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 px-3 py-2 border-2 border-warning bg-warning/10 cursor-pointer">
              <input type="radio" name="phase" value="ROUGH_IN" defaultChecked />
              <span className="text-[12px] font-extrabold">Rough-in</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-2 border-2 border-success bg-success/10 cursor-pointer">
              <input type="radio" name="phase" value="FINAL" />
              <span className="text-[12px] font-extrabold">Final</span>
            </label>
          </div>
        </div>

        <UploadButton compressing={compressing} />
        {uploadState?.error ? (
          <p className="text-[11px] text-error font-mono">{uploadState.error}</p>
        ) : null}
        {uploadState?.ok ? (
          <p className="text-[11px] text-success font-mono">✓ Uploaded</p>
        ) : null}
      </form>
    </div>
  );
}
