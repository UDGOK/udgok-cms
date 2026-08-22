'use client';

/**
 * PhotoUploadSheet — combines the metadata form, the prominent
 * progress / success / error card, and the auto-compression
 * pipeline. Lives inside the BottomSheet on both mobile and
 * desktop (the sheet is centered as a modal on md+).
 *
 * Flow:
 *   1. User picks a file + fills the form fields
 *   2. onSubmit → preflight (size + MIME) → compress →
 *      useBlobUpload.upload(compressedFile, payload)
 *   3. While uploading, the progress card shows file name +
 *      percentage + a fat progress bar
 *   4. On done, the success card shows the URL and a "View
 *      photo" button. After the server's onUploadCompleted
 *      callback settles, router.refresh() repopulates the
 *      photos list; we match the new row by URL to find
 *      the new id
 *   5. On error, the error card shows the message + "Try
 *      again" button (resets the hook and re-enables the form)
 *
 * Extracted from ProjectPhotosClient.tsx as part of the
 * Aug 2026 photo-component refactor.
 */

import { useEffect, useRef, useState } from 'react';
import { GeoPhotoCapture } from '@/components/files/GeoPhotoCapture';
import { compressImage } from '@/lib/images/compress';
import { useBlobUpload } from '@/lib/blob/client-upload';
import {
  buildPhotoUploadPayload,
  preflightPhoto,
  MAX_PHOTO_BYTES,
} from '@/lib/photos/upload-payload';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';
import type { PhotoFolder } from './types';
import { useLatestPhotoIdForUrl } from './hooks';
import {
  UploadProgressCard,
  UploadSuccessCard,
  UploadErrorCard,
} from './PhotoUploadCards';

// How long to wait after the Vercel Blob PUT resolves before
// telling Next.js to revalidate the page. The handleUpload
// flow is two-phase: the client upload resolves the moment
// Vercel Blob confirms the bytes, but the server's
// onUploadCompleted callback (which creates the ProjectPhoto
// row + calls revalidatePath) is dispatched by Vercel AFTER
// that. 1500ms is a comfortable margin — small enough that
// the user doesn't notice, large enough to cover cold starts.
// Same constant as the files upload form.
const SERVER_CALLBACK_SETTLE_MS = 1500;

export function PhotoUploadSheet({
  projectId,
  currentUserId,
  initialFolders,
  activeFolderId,
  photos,
  onUploaded,
  onClose,
  onAfterUpload,
}: {
  workspaceSlug: string;
  projectId: string;
  currentUserId: string;
  initialFolders: PhotoFolder[];
  activeFolderId: string | null;
  photos: ProjectPhotoListItem[];
  onUploaded: (newPhotoId: string | null) => void;
  onClose: () => void;
  onAfterUpload: () => void;
}) {
  // Direct-browser → Vercel Blob upload with progress events.
  // The 50MB cap matches the route's `maximumSizeInBytes`, so
  // the hook's pre-flight size check rejects oversize files
  // BEFORE flipping `phase: 'uploading'` (no spurious progress
  // bar for files we never started uploading).
  const { upload, state, reset } = useBlobUpload({
    handleUploadUrl: `/api/projects/${projectId}/photos/upload`,
    maxBytes: MAX_PHOTO_BYTES,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  // The most-recently-uploaded blob URL. Used to find the
  // new row in `photos` after the server callback settles
  // and router.refresh() has repopulated the list.
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);

  // After the upload resolves, wait briefly for the server's
  // onUploadCompleted to finish (creates the ProjectPhoto
  // row + revalidates the cache), then trigger a client-side
  // revalidation so the new photo shows up in the list.
  //
  // Same 1500ms settle pattern as the workspace-files
  // UploadForm — the Vercel Blob client's `upload()` resolves
  // the moment Vercel Blob confirms the bytes, BEFORE the
  // server's onUploadCompleted has created the row. Without
  // the delay, router.refresh() would race the row insert.
  useEffect(() => {
    if (state.phase !== 'done' || !state.result) return;
    const refreshTimer = setTimeout(() => {
      onAfterUpload();
    }, SERVER_CALLBACK_SETTLE_MS);
    return () => clearTimeout(refreshTimer);
  }, [state.phase, state.result, onAfterUpload]);

  // When the parent re-renders with a new photos list (after
  // refresh), find the row matching the most recent upload
  // URL. Fire onUploaded with the new id so the parent can
  // scroll to it.
  const latestPhotoId = useLatestPhotoIdForUrl(photos, lastUploadedUrl);

  // The "View photo" button: only enabled once we know the
  // new row's id.
  const canViewPhoto = state.phase === 'done' && Boolean(latestPhotoId);

  function handleViewPhoto() {
    if (latestPhotoId) {
      onUploaded(latestPhotoId);
      onClose();
    }
  }

  // Reset the form and hook state so the user can try again
  // after an error. We DON'T auto-reset on phase === 'done'
  // because the success card stays up so the user can tap
  // "View photo".
  function handleTryAgain() {
    reset();
    setLastUploadedUrl(null);
    setPreflightError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.phase === 'uploading' || compressing) return;
    const fileInput = fileInputRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      setPreflightError('Please pick a photo');
      return;
    }
    const file = fileInput.files[0];

    // Pre-flight checks run BEFORE we set phase: 'uploading'.
    // The hook will also catch oversize, but we want a
    // friendlier error message specific to photos and we
    // want it to surface in our own error card without
    // needing the hook to flip into 'error' phase.
    const pre = preflightPhoto(file);
    if (!pre.ok) {
      setPreflightError(pre.reason);
      return;
    }
    setPreflightError(null);

    // Snapshot the form fields BEFORE compression so we can
    // build the payload from the latest user input.
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const folderId = (fd.get('folderId') as string | null) || '';
    const room = (fd.get('room') as string | null) || '';
    const area = (fd.get('area') as string | null) || '';
    const caption = (fd.get('caption') as string | null) || '';
    const phase = ((fd.get('phase') as string | null) || 'ROUGH_IN') as 'ROUGH_IN' | 'FINAL';

    setCompressing(true);
    let compressed: File;
    try {
      compressed = await compressImage(file);
    } catch (err) {
      setCompressing(false);
      setPreflightError(
        err instanceof Error ? err.message : 'Could not prepare this image',
      );
      return;
    }
    setCompressing(false);

    const payload = buildPhotoUploadPayload({
      projectId,
      uploaderId: currentUserId,
      folderId,
      room,
      area,
      phase,
      caption,
      // No takenAt in the manual form — the user can add
      // that on the photo detail page if they care.
      takenAt: null,
      latitude: null,
      longitude: null,
    });

    try {
      const result = await upload(compressed, payload);
      if (result?.url) {
        setLastUploadedUrl(result.url);
      }
    } catch {
      // The hook already populated state.error. Nothing
      // to do here — the error card renders from state.
    }
  }

  async function handleGeophotoUpload(
    file: File,
    meta: { latitude?: number; longitude?: number; takenAt?: Date },
  ) {
    if (state.phase === 'uploading' || compressing) return;
    const pre = preflightPhoto(file);
    if (!pre.ok) {
      setPreflightError(pre.reason);
      return;
    }
    setPreflightError(null);

    // Read the folder/room/area/caption/phase fields the
    // user has filled in the manual form, so the GPS-photo
    // path picks them up too. The phase defaults to ROUGH_IN
    // for geo captures — the GeoPhotoCapture component is
    // designed for on-site progress photos.
    const fd = formRef.current ? new FormData(formRef.current) : new FormData();
    const folderId = (fd.get('folderId') as string | null) || '';
    const room = (fd.get('room') as string | null) || '';
    const area = (fd.get('area') as string | null) || '';
    const caption = (fd.get('caption') as string | null) || '';
    const phase = ((fd.get('phase') as string | null) || 'ROUGH_IN') as 'ROUGH_IN' | 'FINAL';

    setCompressing(true);
    let compressed: File;
    try {
      compressed = await compressImage(file);
    } catch (err) {
      setCompressing(false);
      setPreflightError(
        err instanceof Error ? err.message : 'Could not prepare this image',
      );
      return;
    }
    setCompressing(false);

    const payload = buildPhotoUploadPayload({
      projectId,
      uploaderId: currentUserId,
      folderId,
      room,
      area,
      phase,
      caption,
      takenAt: meta.takenAt ?? null,
      latitude: meta.latitude ?? null,
      longitude: meta.longitude ?? null,
    });

    try {
      const result = await upload(compressed, payload);
      if (result?.url) {
        setLastUploadedUrl(result.url);
      }
    } catch {
      // hook populates state.error
    }
  }

  // While uploading, hide the form and show ONLY the
  // progress card. Otherwise show the form plus a status
  // card for success / error.
  const showProgressCard = state.phase === 'uploading';
  const showSuccessCard = state.phase === 'done';
  const showErrorCard = state.phase === 'error';

  return (
    <div className="space-y-4">
      {/* GPS / camera capture path. Always visible (except
          while uploading, where we hide everything in favor
          of the progress card). */}
      {!showProgressCard ? (
        <div className="p-3 bg-cream-2 border border-line">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-2">
            Take a GPS-tagged photo
          </div>
          <GeoPhotoCapture onCapture={handleGeophotoUpload} label="Open camera" />
        </div>
      ) : null}

      {!showProgressCard ? (
        <div className="text-center text-[10px] font-mono uppercase tracking-[0.1em] text-ink-30">— or —</div>
      ) : null}

      {/* Manual form. Hidden while uploading so the
          progress card is the only thing the user sees. */}
      {!showProgressCard ? (
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

          <button
            type="submit"
            disabled={state.phase === 'uploading' || compressing}
            className="w-full px-4 py-3 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-50"
          >
            {compressing
              ? 'Compressing…'
              : state.phase === 'uploading'
              ? `Uploading… ${state.progress}%`
              : 'Upload photo'}
          </button>

          {preflightError ? (
            <div className="border-2 border-error bg-error/10 p-2 text-[12px] text-error font-bold">
              ⚠ {preflightError}
            </div>
          ) : null}
        </form>
      ) : null}

      {/* Progress / success / error cards. These render
          inside the sheet (NOT as a modal) per the spec. */}
      {showProgressCard ? (
        <UploadProgressCard
          fileName={state.result?.pathname ?? 'Uploading…'}
          uploadedBytes={state.uploadedBytes}
          totalBytes={state.totalBytes}
          progress={state.progress}
        />
      ) : null}

      {showSuccessCard ? (
        <UploadSuccessCard
          fileName={state.result?.pathname ?? 'photo'}
          url={state.result?.url ?? null}
          photoId={latestPhotoId}
          canView={canViewPhoto}
          onView={handleViewPhoto}
          onUploadAnother={handleTryAgain}
        />
      ) : null}

      {showErrorCard ? (
        <UploadErrorCard
          message={state.error ?? 'Upload failed'}
          onRetry={handleTryAgain}
        />
      ) : null}
    </div>
  );
}
