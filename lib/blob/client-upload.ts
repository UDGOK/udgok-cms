'use client';

import { useCallback, useState } from 'react';
import { upload as vercelUpload } from '@vercel/blob/client';
import { formatBytes } from '@/lib/images/compress';

/**
 * Shared hook for direct browser → Vercel Blob uploads. Bypasses
 * the 4.5MB Vercel function body limit by talking to the Blob
 * API directly with a `handleUpload` token. Files up to 500MB
 * work — same cap as the BIM/IFC uploader.
 *
 * The server-side `handleUpload` route is responsible for:
 *   - Auth (role check)
 *   - Creating the File row on `onUploadCompleted`
 *   - Token-payload validation
 *
 * The hook here handles client-side state: progress, error, and
 * a clean reset. Components just call `upload(file)` and the hook
 * takes care of the rest.
 *
 * Usage:
 *   const { upload, state, reset } = useBlobUpload({
 *     handleUploadUrl: '/api/files/upload',
 *   });
 *   await upload(file, { workspaceId, category });
 *   if (state.error) showError(state.error);
 */
export type UploadState = {
  isUploading: boolean;
  progress: number;     // 0..100
  phase: 'idle' | 'uploading' | 'done' | 'error';
  error: string | null;
  uploadedBytes: number;
  totalBytes: number;
  result: { url: string; pathname: string } | null;
};

const initial: UploadState = {
  isUploading: false,
  progress: 0,
  phase: 'idle',
  error: null,
  uploadedBytes: 0,
  totalBytes: 0,
  result: null,
};

interface UseBlobUploadOpts {
  /** Path of the handleUpload route (e.g. `/api/files/upload`). */
  handleUploadUrl: string;
  /** Maximum bytes — 500MB by default (Vercel Blob hard cap). */
  maxBytes?: number;
  /** Optional callback on each progress tick. */
  onProgress?: (pct: number) => void;
}

export function useBlobUpload(opts: UseBlobUploadOpts) {
  const { handleUploadUrl, maxBytes = 500 * 1024 * 1024, onProgress } = opts;
  const [state, setState] = useState<UploadState>(initial);

  const reset = useCallback(() => setState(initial), []);

  const upload = useCallback(
    async (file: File, tokenPayload: Record<string, string> = {}) => {
      if (state.phase === 'uploading') {
        throw new Error('Upload already in progress');
      }
      if (file.size > maxBytes) {
        const msg = `File too large (${formatBytes(file.size)} > ${formatBytes(maxBytes)} cap)`;
        setState((s) => ({ ...s, phase: 'error', error: msg }));
        throw new Error(msg);
      }
      setState({
        isUploading: true,
        progress: 0,
        phase: 'uploading',
        error: null,
        uploadedBytes: 0,
        totalBytes: file.size,
        result: null,
      });
      try {
        const result = await vercelUpload(file.name, file, {
          access: 'public',
          handleUploadUrl,
          contentType: file.type || 'application/octet-stream',
          // The route's onBeforeGenerateToken receives this as
          // `clientPayload` (a JSON string). The route then
          // echoes it back as `tokenPayload` on onUploadCompleted
          // so we can recreate metadata rows server-side.
          clientPayload: JSON.stringify(tokenPayload),
          onUploadProgress: ({ percentage }) => {
            const pct = Math.round(percentage);
            setState((s) => ({
              ...s,
              progress: pct,
              // Approximate the byte counts from the percentage so
              // the progress bar shows the real ratio even without
              // the byte-level event payload.
              uploadedBytes: Math.round((pct / 100) * file.size),
              totalBytes: file.size,
            }));
            onProgress?.(pct);
          },
        });
        setState((s) => ({
          ...s,
          isUploading: false,
          phase: 'done',
          progress: 100,
          result: { url: result.url, pathname: result.pathname },
        }));
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setState((s) => ({
          ...s,
          isUploading: false,
          phase: 'error',
          error: msg.slice(0, 500),
        }));
        throw e;
      }
    },
    [handleUploadUrl, maxBytes, onProgress, state.phase],
  );

  return { upload, state, reset };
}
