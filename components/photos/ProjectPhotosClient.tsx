'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';
import type { PhotoPhase } from '@prisma/client';
import { GeoPhotoCapture } from '@/components/files/GeoPhotoCapture';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { uploadProjectPhotoAction, deleteProjectPhotoAction } from '@/lib/photos/actions';
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
  /** ID of the signed-in user. Photo is deletable if they uploaded it. */
  currentUserId: string;
  /** Master admins can delete any photo in their workspaces. */
  canDeleteAny: boolean;
}

/** Compute whether the current user can delete a given photo. */
function userCanDelete(
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
  const [pendingDeleteId, startDelete] = useTransition();
  const [uploadState, uploadFormAction] = useFormState(
    uploadProjectPhotoAction.bind(null, workspaceSlug),
    undefined,
  );

  // Close the sheet when upload succeeds. Must be useEffect, not
  // useState — the latter only runs the body once on mount when
  // uploadState is still `undefined`, so the sheet would never
  // close after a successful upload. (Caught by the regression
  // test in __tests__/ProjectPhotosClient.test.ts.)
  useEffect(() => {
    if (uploadState?.ok) {
      setSheetOpen(false);
      router.refresh();
    }
  }, [uploadState, router]);

  async function handleGeophotoUpload(file: File, meta: { latitude?: number; longitude?: number; takenAt?: Date }) {
    // Compress first — phone-camera photos are routinely 5-10 MB
    // and the Vercel function payload limit is 4.5 MB.
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

  function handleDelete(id: string) {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    startDelete(async () => {
      const res = await deleteProjectPhotoAction(workspaceSlug, id);
      if (res.ok) {
        setPhotos((p) => p.filter((x) => x.id !== id));
        if (lightbox?.id === id) setLightbox(null);
        router.refresh();
      } else {
        alert(res.error ?? 'Delete failed');
      }
    });
  }

  const filtered = photos.filter((p) => {
    if (filterPhase !== 'ALL' && p.phase !== filterPhase) return false;
    if (filterRoom && p.room !== filterRoom) return false;
    if (filterArea && p.area !== filterArea) return false;
    return true;
  });

  return (
    <div>
      {/* Folder tabs — server-rendered strip with the active folder highlighted */}
      <PhotoFolderTabs
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        folders={initialFolders}
        activeFolderId={activeFolderId}
        totalPhotos={initialFacets.roughInCount + initialFacets.finalCount}
      />

      {/* Header bar with phase toggle + filters + add button */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        {/* Phase toggle (large, primary control) */}
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

        {/* Room filter */}
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

        {/* Area filter */}
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

        {/* Add button — desktop shows it inline, mobile triggers sheet */}
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
              canDelete={userCanDelete(p, currentUserId, canDeleteAny)}
              onDelete={() => handleDelete(p.id)}
              pendingDelete={pendingDeleteId}
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
        />
      ) : null}

      {/* Mobile upload sheet (always available, useful on desktop too) */}
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

function PhotoCard({
  photo,
  onClick,
  canDelete,
  onDelete,
  pendingDelete,
}: {
  photo: ProjectPhotoListItem;
  onClick: () => void;
  canDelete: boolean;
  onDelete: () => void;
  pendingDelete: boolean;
}) {
  return (
    <div
      className="bg-paper border-2 border-line overflow-hidden cursor-pointer hover:border-ink transition-colors relative group"
      onClick={onClick}
    >
      {/* Phase badge — color-coded */}
      <div
        className={`absolute top-2 left-2 z-10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
          photo.phase === 'ROUGH_IN' ? 'bg-warning text-ink' : 'bg-success text-paper'
        }`}
      >
        {photo.phase === 'ROUGH_IN' ? 'Rough-in' : 'Final'}
      </div>
      {/* Folder badge */}
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
      {canDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={pendingDelete}
          className="absolute top-2 right-2 z-10 w-7 h-7 bg-ink/80 text-cream hover:bg-error opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Delete"
        >
          ×
        </button>
      ) : null}
      <div className="aspect-square bg-cream-2 relative">
        <img
          src={photo.url}
          alt={photo.caption || photo.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-2">
        {photo.room || photo.area ? (
          <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink truncate">
            {[photo.room, photo.area].filter(Boolean).join(' · ')}
          </div>
        ) : null}
        {photo.caption ? (
          <div className="text-[11px] mt-0.5 truncate">{photo.caption}</div>
        ) : (
          <div className="text-[10px] text-ink-50 truncate">{photo.filename}</div>
        )}
        {photo.latitude ? (
          <div className="text-[9px] font-mono text-success mt-0.5">📍 GPS</div>
        ) : null}
      </div>
    </div>
  );
}

function Lightbox({
  photo,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: {
  photo: ProjectPhotoListItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  totalCount: number;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 w-10 h-10 text-cream text-2xl border-2 border-cream/30 hover:border-cream flex items-center justify-center"
        aria-label="Close"
      >
        ×
      </button>

      {/* Counter */}
      <div className="absolute top-3 left-3 z-10 text-cream text-[10px] font-mono uppercase tracking-[0.15em] bg-ink/60 px-3 py-1.5">
        {currentIndex + 1} / {totalCount}
      </div>

      {/* Prev */}
      {totalCount > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-12 h-12 text-cream text-2xl border-2 border-cream/30 hover:border-cream flex items-center justify-center"
          aria-label="Previous photo"
        >
          ‹
        </button>
      ) : null}

      {/* Next */}
      {totalCount > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-12 h-12 text-cream text-2xl border-2 border-cream/30 hover:border-cream flex items-center justify-center"
          aria-label="Next photo"
        >
          ›
        </button>
      ) : null}

      <img
        src={photo.url}
        alt={photo.caption || photo.filename}
        className="max-w-[90vw] max-h-[80vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-ink/80 text-cream p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                photo.phase === 'ROUGH_IN' ? 'bg-warning text-ink' : 'bg-success'
              }`}
            >
              {photo.phase === 'ROUGH_IN' ? 'Rough-in' : 'Final'}
            </span>
            {photo.folderName ? (
              <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] bg-orange text-paper">
                {photo.folderName}
              </span>
            ) : null}
            {photo.room ? (
              <span className="text-[11px] font-mono uppercase tracking-[0.05em]">{photo.room}</span>
            ) : null}
            {photo.area ? (
              <span className="text-[11px] font-mono uppercase tracking-[0.05em] text-cream/60">
                · {photo.area}
              </span>
            ) : null}
            {photo.latitude ? (
              <span className="text-[10px] font-mono text-success ml-auto">📍 {photo.latitude.toFixed(4)}, {photo.longitude?.toFixed(4)}</span>
            ) : null}
          </div>
          {photo.caption ? <p className="text-[13px] mt-1">{photo.caption}</p> : null}
          <p className="text-[10px] font-mono text-cream/50 mt-2">
            {photo.uploader.name || photo.uploader.email} · {new Date(photo.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

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
      // No file — fall through to the form action
      const fd = new FormData(form);
      uploadFormAction(fd);
      return;
    }
    setCompressing(true);
    try {
      const file = fileInput.files[0];
      const compressed = await compressImage(file);
      // Build a new FormData from the form, but with the compressed file
      // replacing the original. Copy every other field as-is.
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
      {/* GPS capture option */}
      <div className="p-3 bg-cream-2 border border-line">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-2">
          Take a GPS-tagged photo
        </div>
        <GeoPhotoCapture onCapture={onGeoCapture} label="Open camera" />
      </div>

      <div className="text-center text-[10px] font-mono uppercase tracking-[0.1em] text-ink-30">— or —</div>

      {/* Manual upload with categorization */}
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

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
            Caption (optional)
          </label>
          <input
            type="text"
            name="caption"
            placeholder="What's in this photo?"
            maxLength={500}
            className="w-full px-3 py-2 bg-paper border border-line text-[12px]"
          />
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
