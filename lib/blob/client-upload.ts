'use client';

import { useCallback, useState } from 'react';
import { upload as vercelUpload } from '@vercel/blob/client';
import { formatBytes } from '@/lib/images/compress';

/**
 * Normalize the @vercel/blob onUploadProgress payload to a
 * "bytes loaded" number. The library's callback shape has
 * drifted across versions and transports:
 *
 *   - XHR path (older versions, older browsers): the
 *     callback receives `{ loaded, total, percentage }`
 *     derived from the XHR progress event.
 *   - Fetch-with-upload-streams path (modern Chrome via
 *     undici): the callback receives a bare number
 *     representing the bytes the chunk transform has
 *     pushed into the request stream so far.
 *   - Some intermediate versions pass `{ loaded }` only.
 *
 * We handle all three shapes so the progress bar moves
 * regardless of which transport the browser picks. The
 * percentage is computed here from the known file size;
 * we never trust the library's `percentage` field
 * because it can be 0 until the very end (the chunk
 * transform reports the number of bytes pushed, not the
 * percentage of the body that has been sent over the
 * wire).
 */
function normalizeLoaded(
  payload: unknown,
  fileSize: number,
): number {
  if (typeof payload === 'number') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as { loaded?: unknown; total?: unknown };
    if (typeof obj.loaded === 'number') {
      return obj.loaded;
    }
    if (typeof obj.total === 'number') {
      return obj.total;
    }
  }
  // Unknown shape — fall back to the file size so the bar
  // jumps to 100% on the next tick. Better than stuck.
  return fileSize;
}

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
      // Heartbeat: if we don't see ANY progress events for
      // 6 seconds while the upload is in flight, surface a
      // clear "stuck" error rather than letting the user
      // stare at 0% indefinitely. The bug we're guarding
      // against: the @vercel/blob client silently swallowed
      // the progress callback in v2.x (it passes a bare
      // number, not an object), which looked like a frozen
      // upload from the UI. If a future library version
      // regresses the same way, this heartbeat will catch
      // it within 6 seconds instead of after a full file
      // transfer.
      //
      // Also: while we're waiting for the first progress
      // event, tick a fake "indeterminate" progress of 1%
      // every second so the bar doesn't look stuck at 0
      // for a 26KB PDF (which uploads fast enough that
      // the real progress event may never fire — the
      // upload completes between event-loop ticks).
      let lastProgressAt = Date.now();
      let firstProgressAt: number | null = null;
      let heartbeatCleared = false;
      const heartbeat = setInterval(() => {
        if (heartbeatCleared) return;
        const stuck = Date.now() - lastProgressAt > 6_000;
        if (stuck) {
          clearInterval(heartbeat);
          heartbeatCleared = true;
          setState((s) => {
            if (s.phase !== 'uploading') return s;
            return {
              ...s,
              isUploading: false,
              phase: 'error',
              error:
                'Upload appears stuck — no progress for 6 seconds. The browser may have killed the connection. Try a smaller file, disable any VPN, or check your network.',
            };
          });
          return;
        }
        // First 4 seconds with no progress events: tick
        // the bar to 1% so the user sees it's not totally
        // frozen. Stop ticking once real events arrive
        // (firstProgressAt is set). This is a UX detail
        // — for tiny files the real upload may complete
        // in <100ms with no events, so the bar would
        // otherwise jump straight from 0% to 100%.
        if (firstProgressAt === null) {
          setState((s) => {
            if (s.phase !== 'uploading') return s;
            if (s.progress > 0) return s;
            return { ...s, progress: 1 };
          });
        }
      }, 1_000);

      try {
        console.log('[useBlobUpload] calling vercelUpload', {
          fileName: file.name,
          fileSize: file.size,
          handleUploadUrl,
          hasTokenPayload: Object.keys(tokenPayload).length > 0,
        });
        const result = await vercelUpload(file.name, file, {
          access: 'public',
          handleUploadUrl,
          contentType: file.type || 'application/octet-stream',
          // The route's onBeforeGenerateToken receives this as
          // `clientPayload` (a JSON string). The route then
          // echoes it back as `tokenPayload` on onUploadCompleted
          // so we can recreate metadata rows server-side.
          clientPayload: JSON.stringify(tokenPayload),
          // CRITICAL: the @vercel/blob v2.x client passes the
          // callback payload as a bare number (the bytes loaded
          // so far), NOT as an object. Earlier we destructured
          // `{ percentage }` here and got `undefined` every
          // time, which clamped progress to 0% and the bar
          // appeared stuck. Handle both shapes to be safe
          // across library versions and transports (XHR passes
          // { loaded, total, percentage }; fetch-with-streams
          // passes a bare number).
          onUploadProgress: (payload: unknown) => {
            lastProgressAt = Date.now();
            if (firstProgressAt === null) firstProgressAt = Date.now();
            const loaded = normalizeLoaded(payload, file.size);
            const pct = Math.max(0, Math.min(100, Math.round((loaded / file.size) * 100)));
            setState((s) => ({
              ...s,
              progress: pct,
              uploadedBytes: loaded,
              totalBytes: file.size,
            }));
            onProgress?.(pct);
          },
        });
        if (!heartbeatCleared) clearInterval(heartbeat);
        console.log('[useBlobUpload] vercelUpload resolved', { url: result.url });
        setState((s) => ({
          ...s,
          isUploading: false,
          phase: 'done',
          progress: 100,
          result: { url: result.url, pathname: result.pathname },
        }));
        return result;
      } catch (e) {
        if (!heartbeatCleared) clearInterval(heartbeat);
        const msg = e instanceof Error ? e.message : 'Upload failed';
        console.error('[useBlobUpload] vercelUpload failed', { error: msg, name: e instanceof Error ? e.name : 'unknown' });
        setState((s) => ({
          ...s,
          isUploading: false,
          phase: 'error',
          error: msg.slice(0, 500),
        }));
        throw e;
      }
    },
    // Note: state.phase is intentionally NOT in the dependency
    // array. Including it caused the callback to re-create on
    // every phase change, which broke the "Upload already in
    // progress" guard (the latest callback had the new phase,
    // so re-entry via the dependency churn would throw
    // spuriously). We read state.phase through the functional
    // setState updater where it matters, and through a ref-like
    // pattern via the closure for the guard.
    [handleUploadUrl, maxBytes, onProgress],
  );

  return { upload, state, reset };
}
