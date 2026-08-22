'use client';

/**
 * PhotoEditForm — the form shown inside the lightbox when
 * the user taps "Edit". Captures caption, room, area, phase,
 * folder, and an optional image replacement.
 *
 * Pure presentational. The parent (PhotoLightbox) supplies
 * the photo + folders + handlers, this component owns the
 * form state (caption, room, area, phase, folderId, replace
 * file + preview).
 *
 * Extracted from ProjectPhotosClient.tsx as part of the Aug
 * 2026 photo-component refactor.
 */

import { useEffect, useRef, useState } from 'react';
import type { PhotoPhase } from '@prisma/client';
import { updateProjectPhotoAction } from '@/lib/photos/actions';
import { compressImage } from '@/lib/images/compress';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';
import type { PhotoFolder } from './types';

export function PhotoEditForm({
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
