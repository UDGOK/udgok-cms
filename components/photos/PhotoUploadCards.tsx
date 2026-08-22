'use client';

/**
 * PhotoUploadCards — the three cards shown inside the upload
 * sheet based on upload phase: progress (uploading), success
 * (done), error (error). Each card is presentational; the
 * parent (PhotoUploadSheet) owns the state and decides which
 * to render.
 *
 * Extracted from ProjectPhotosClient.tsx as part of the
 * Aug 2026 photo-component refactor.
 */

import { formatBytes } from '@/lib/images/compress';

export function UploadProgressCard({
  fileName,
  uploadedBytes,
  totalBytes,
  progress,
}: {
  fileName: string;
  uploadedBytes: number;
  totalBytes: number;
  progress: number;
}) {
  return (
    <div className="bg-paper border-2 border-ink p-5 my-2 text-center">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d mb-3">
        {'// Uploading'}
      </div>
      <div className="text-[14px] font-extrabold truncate mb-1" title={fileName}>
        {fileName}
      </div>
      <div className="text-[10px] font-mono text-ink-50 mb-4">
        {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
      </div>
      <div className="text-[42px] font-black tabular-nums leading-none mb-3 text-ink">
        {progress}%
      </div>
      <div className="h-3 w-full bg-cream-2 border-2 border-ink overflow-hidden">
        <div
          className="h-full bg-orange transition-[width] duration-100"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="text-[10px] font-mono text-ink-50 mt-3 uppercase tracking-[0.1em]">
        Keep this tab open until the upload finishes
      </p>
    </div>
  );
}

export function UploadSuccessCard({
  fileName,
  url,
  photoId,
  canView,
  onView,
  onUploadAnother,
}: {
  fileName: string;
  url: string | null;
  photoId: string | null;
  canView: boolean;
  onView: () => void;
  onUploadAnother: () => void;
}) {
  return (
    <div className="bg-paper border-2 border-success p-5 my-2">
      <div className="text-center mb-3">
        <div className="inline-flex w-12 h-12 items-center justify-center bg-success text-paper text-2xl font-black mb-2">
          ✓
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-success mb-1">
          {'// Upload complete'}
        </div>
        <div className="text-[14px] font-extrabold truncate" title={fileName}>
          {fileName}
        </div>
      </div>
      {photoId ? (
        <div className="text-center mb-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
            Photo ID
          </div>
          <div className="text-[12px] font-mono text-ink-70 break-all">{photoId}</div>
        </div>
      ) : (
        <div className="text-center mb-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            Indexing… the new row will appear in the gallery in a moment
          </div>
        </div>
      )}
      {url ? (
        <div className="text-center mb-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
            URL
          </div>
          <div className="text-[10px] font-mono text-ink-70 break-all">{url}</div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onView}
          disabled={!canView}
          className="w-full px-4 py-2.5 bg-success text-paper border-2 border-success text-[11px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-50 hover:bg-success/80"
        >
          {canView ? 'View photo' : 'Indexing…'}
        </button>
        <button
          type="button"
          onClick={onUploadAnother}
          className="w-full px-4 py-2.5 bg-paper text-ink border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-paper"
        >
          Upload another
        </button>
      </div>
    </div>
  );
}

export function UploadErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-paper border-2 border-error p-5 my-2">
      <div className="text-center mb-3">
        <div className="inline-flex w-12 h-12 items-center justify-center bg-error text-paper text-2xl font-black mb-2">
          ⚠
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-error mb-1">
          {'// Upload failed'}
        </div>
      </div>
      <div className="bg-error/10 border-l-4 border-error p-3 mb-4 text-[12px] text-ink break-words">
        {message}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="w-full px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d"
      >
        Try again
      </button>
    </div>
  );
}
