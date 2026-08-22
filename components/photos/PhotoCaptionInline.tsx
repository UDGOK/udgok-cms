'use client';

/**
 * PhotoCaptionInline — the inline rename input that replaces
 * the caption text in PhotoCard. Click caption to rename, Enter
 * to save, Esc to cancel.
 *
 * Extracted from the 1,733-LOC ProjectPhotosClient.tsx so it
 * can be tested in isolation and lazy-loaded. See the original
 * file (now ~250 LOC) for the dispatch logic.
 */

import { useEffect, useRef, useState } from 'react';
import { updateProjectPhotoAction } from '@/lib/photos/actions';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';

export function PhotoCaptionInline({
  photo,
  workspaceSlug,
  onCancel,
  onSaved,
}: {
  photo: ProjectPhotoListItem;
  workspaceSlug: string;
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
        ✕
      </button>
    </div>
  );
}
