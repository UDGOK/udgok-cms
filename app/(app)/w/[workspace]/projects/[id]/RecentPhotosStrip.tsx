'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';

interface RecentPhotosStripProps {
  workspaceSlug: string;
  projectId: string;
  photos: ProjectPhotoListItem[];
  totalCount: number;
}

/**
 * Strip of the most recent photos for a project, rendered on the
 * project Overview tab. Clicking a photo opens an in-page lightbox
 * with prev/next navigation. Clicking the "View all" link takes the
 * user to the dedicated /photos route.
 */
export function RecentPhotosStrip({
  workspaceSlug,
  projectId,
  photos,
  totalCount,
}: RecentPhotosStripProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="bg-paper border-2 border-line p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {'// Photos'}
          </div>
          <Link
            href={`/w/${workspaceSlug}/projects/${projectId}/photos`}
            className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d hover:text-ink"
          >
            Open gallery →
          </Link>
        </div>
        <div className="text-center py-6 text-ink-50 text-[12px]">
          No photos yet. Capture your first one from the Photos tab.
        </div>
      </div>
    );
  }

  const open = photos[lightboxIdx ?? 0];
  const prev = () =>
    setLightboxIdx((i) => (i === null ? 0 : i === 0 ? photos.length - 1 : i - 1));
  const next = () =>
    setLightboxIdx((i) => (i === null ? 0 : i === photos.length - 1 ? 0 : i + 1));

  return (
    <div className="bg-paper border-2 border-line">
      <div className="px-4 md:px-5 py-3 border-b border-line flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {'// Recent photos'}
          </div>
          <div className="text-[12px] text-ink mt-0.5">
            <span className="font-extrabold">{photos.length}</span> most recent of{' '}
            <span className="font-extrabold">{totalCount}</span> total
          </div>
        </div>
        <Link
          href={`/w/${workspaceSlug}/projects/${projectId}/photos`}
          className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d hover:text-ink font-extrabold"
        >
          View all →
        </Link>
      </div>

      {/* Strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-line">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setLightboxIdx(i)}
            className="group relative aspect-square overflow-hidden bg-cream-2 cursor-pointer hover:opacity-90"
            title={p.caption || p.filename}
          >
            <img
              src={p.url}
              alt={p.caption || p.filename}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            {/* Phase badge */}
            <div
              className={`absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] ${
                p.phase === 'ROUGH_IN' ? 'bg-warning text-ink' : 'bg-success text-paper'
              }`}
            >
              {p.phase === 'ROUGH_IN' ? 'R' : 'F'}
            </div>
            {/* Folder badge */}
            {p.folderName ? (
              <div className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] bg-ink text-cream">
                {p.folderName.slice(0, 8)}
              </div>
            ) : null}
            {p.room ? (
              <div className="absolute bottom-0 left-0 right-0 bg-ink/80 text-cream px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] truncate">
                {p.room}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {/* Lightbox with prev/next */}
      {lightboxIdx !== null && open ? (
        <div
          className="fixed inset-0 z-50 bg-ink/95 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            className="absolute top-3 right-3 z-10 w-10 h-10 text-cream text-2xl border-2 border-cream/30 hover:border-cream flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>

          {/* Photo counter */}
          <div className="absolute top-3 left-3 z-10 text-cream text-[10px] font-mono uppercase tracking-[0.15em] bg-ink/60 px-3 py-1.5">
            {lightboxIdx + 1} / {photos.length}
          </div>

          {/* Prev */}
          {photos.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-12 h-12 text-cream text-2xl border-2 border-cream/30 hover:border-cream flex items-center justify-center"
              aria-label="Previous photo"
            >
              ‹
            </button>
          ) : null}

          {/* Next */}
          {photos.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-12 h-12 text-cream text-2xl border-2 border-cream/30 hover:border-cream flex items-center justify-center"
              aria-label="Next photo"
            >
              ›
            </button>
          ) : null}

          <img
            src={open.url}
            alt={open.caption || open.filename}
            className="max-w-[90vw] max-h-[80vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-0 left-0 right-0 bg-ink/80 text-cream p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                    open.phase === 'ROUGH_IN' ? 'bg-warning text-ink' : 'bg-success'
                  }`}
                >
                  {open.phase === 'ROUGH_IN' ? 'Rough-in' : 'Final'}
                </span>
                {open.folderName ? (
                  <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] bg-orange text-paper">
                    {open.folderName}
                  </span>
                ) : null}
                {open.room ? (
                  <span className="text-[11px] font-mono uppercase tracking-[0.05em]">{open.room}</span>
                ) : null}
                {open.area ? (
                  <span className="text-[11px] font-mono uppercase tracking-[0.05em] text-cream/60">
                    · {open.area}
                  </span>
                ) : null}
                {open.latitude ? (
                  <span className="text-[10px] font-mono text-success ml-auto">
                    📍 {open.latitude.toFixed(4)}, {open.longitude?.toFixed(4)}
                  </span>
                ) : null}
              </div>
              {open.caption ? <p className="text-[13px] mt-1">{open.caption}</p> : null}
              <p className="text-[10px] font-mono text-cream/50 mt-2">
                {open.uploader.name || open.uploader.email} ·{' '}
                {new Date(open.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
