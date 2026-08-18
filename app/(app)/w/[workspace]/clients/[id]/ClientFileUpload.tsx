'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBlobUpload } from '@/lib/blob/client-upload';
import { formatBytes } from '@/lib/images/compress';

/**
 * File upload for the client's "Files" tab. Direct browser → Vercel
 * Blob upload via the `/api/clients/files` handleUpload route, so
 * files up to 500MB work (Vercel's function body cap is 4.5MB,
 * which silently killed the old `multipart/form-data` POST path).
 */
export function ClientFileUpload({
  clientId,
  workspaceId,
  uploaderId,
}: {
  clientId: string;
  workspaceId: string;
  uploaderId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { upload, state, reset } = useBlobUpload({
    handleUploadUrl: '/api/clients/files',
  });

  async function onPick(file: File) {
    try {
      await upload(file, {
        workspaceId,
        uploaderId,
        clientId,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch {
      // state.error is already populated by the hook
    }
  }

  return (
    <div className="px-5 py-4 border-b border-line bg-cream-2">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={state.isUploading}
          className="px-4 py-2 bg-ink text-cream border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink-2 disabled:opacity-50"
        >
          {state.isUploading ? `Uploading… ${state.progress}%` : '+ Upload file'}
        </button>
        {state.phase === 'uploading' ? (
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
              <span className="text-ink-70">
                {formatBytes(state.uploadedBytes)} / {formatBytes(state.totalBytes)}
              </span>
              <span className="text-ink-50">{state.progress}%</span>
            </div>
            <div className="h-1 bg-line">
              <div className="h-full bg-ink transition-[width] duration-100" style={{ width: `${state.progress}%` }} />
            </div>
          </div>
        ) : null}
        {state.phase === 'done' ? (
          <span className="text-[11px] font-mono text-success">Uploaded ✓</span>
        ) : null}
        {state.error ? (
          <span className="text-[11px] font-mono text-error">⚠ {state.error}</span>
        ) : null}
        <span className="text-[10px] font-mono text-ink-30 uppercase tracking-[0.1em] ml-auto">
          Up to 500 MB · PDF, DOCX, XLSX, images
        </span>
        {state.phase === 'done' ? (
          <button
            type="button"
            onClick={reset}
            className="text-[10px] font-mono text-ink-30 hover:underline"
          >
            clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
