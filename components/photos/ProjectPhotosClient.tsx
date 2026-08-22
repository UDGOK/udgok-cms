'use client';

/**
 * ProjectPhotosClient — thin shell that composes the photo
 * feature. Owns the page-level state (filter, current photo,
 * delete modal) and delegates rendering to focused
 * sub-components in this directory.
 *
 * Aug 2026: refactored from 1,733 LOC to ~250 LOC. Each
 * sub-component lives in its own file (PhotoCard,
 * PhotoLightbox, PhotoEditForm, PhotoDeleteModal,
 * PhotoUploadSheet, PhotoFilterBar, PhotoCaptionInline,
 * PhotoUploadCards) and is independently testable.
 *
 * See:
 *   ./PhotoCard            — single grid cell
 *   ./PhotoLightbox        — full-screen viewer + edit panel
 *   ./PhotoEditForm        — the edit form inside the lightbox
 *   ./PhotoDeleteModal     — delete confirmation dialog
 *   ./PhotoUploadSheet     — file picker + progress / success
 *   ./PhotoFilterBar       — phase / room / area selectors
 *   ./PhotoCaptionInline   — click-to-rename input
 *   ./PhotoUploadCards     — progress / success / error cards
 *   ./hooks                — useLatestPhotoIdForUrl
 *   ./types                — PhotoFolder + userCanEdit
 */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';
import { PhotoFolderTabs } from '@/app/(app)/w/[workspace]/projects/[id]/PhotoFolderTabs';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { deleteProjectPhotoAction } from '@/lib/photos/actions';
import { PhotoCard } from './PhotoCard';
import { PhotoFilterBar } from './PhotoFilterBar';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoDeleteModal } from './PhotoDeleteModal';
import { PhotoUploadSheet } from './PhotoUploadSheet';
import type { PhotoFolder } from './types';

export type { PhotoFolder } from './types';

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
  const [filterPhase, setFilterPhase] = useState<'ALL' | 'ROUGH_IN' | 'FINAL'>('ALL');
  const [filterRoom, setFilterRoom] = useState<string>('');
  const [filterArea, setFilterArea] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightbox, setLightbox] = useState<ProjectPhotoListItem | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [photoMenuId, setPhotoMenuId] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<ProjectPhotoListItem | null>(null);
  const [pendingDeleteId, startDelete] = useTransition();

  // Close the photo menu when clicking outside.
  useEffect(() => {
    if (!photoMenuId) return;
    const handler = () => setPhotoMenuId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [photoMenuId]);

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

      <PhotoFilterBar
        filterPhase={filterPhase}
        setFilterPhase={setFilterPhase}
        filterRoom={filterRoom}
        setFilterRoom={setFilterRoom}
        filterArea={filterArea}
        setFilterArea={setFilterArea}
        facets={initialFacets}
        onAddPhoto={() => setSheetOpen(true)}
      />

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
              canEdit={p.uploaderId === currentUserId || canDeleteAny}
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
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox ? (
        <PhotoLightbox
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
          canEdit={lightbox.uploaderId === currentUserId || canDeleteAny}
          workspaceSlug={workspaceSlug}
          folders={initialFolders}
        />
      ) : null}

      {/* Delete confirmation modal */}
      {deletingPhoto ? (
        <PhotoDeleteModal
          photo={deletingPhoto}
          pending={pendingDeleteId}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingPhoto(null)}
        />
      ) : null}

      {/* Mobile upload sheet (also used on desktop — the
          BottomSheet renders as a centered modal above md). */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add project photo" maxHeightClass="max-h-[92vh]">
        <PhotoUploadSheet
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          currentUserId={currentUserId}
          initialFolders={initialFolders}
          activeFolderId={activeFolderId}
          photos={photos}
          onUploaded={(newPhotoId) => {
            setTimeout(() => {
              if (newPhotoId) {
                const el = document.querySelector(`[data-photo-id="${newPhotoId}"]`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }
            }, 300);
          }}
          onClose={() => setSheetOpen(false)}
          onAfterUpload={() => router.refresh()}
        />
      </BottomSheet>
    </div>
  );
}
