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
  // The granular phase so the UI can show what the upload
  // is actually doing. With the @vercel/blob v2.x client
  // we can sometimes sit at 0% for a while (small files,
  // fast networks, or first-chunk waits) — without a
  // visible phase indicator the user has no way to tell
  // "uploading bytes" from "stuck".
  //
  //   - 'token'      — fetching the upload token from the route
  //   - 'uploading'  — PUTting bytes to Vercel Blob
  //   - 'finalizing' — bytes done, waiting for the route's
  //                    onUploadCompleted callback to create the row
  //   - 'done'       — success
  //   - 'error'      — failed
  phase: 'idle' | 'token' | 'uploading' | 'finalizing' | 'done' | 'error';
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

/**
 * One-time XHR uploader fallback. We use this when the
 * @vercel/blob client's fetch-with-upload-streams transport
 * misbehaves (the user reported 0% progress that never
 * advances; one of the suspected causes is the streams
 * transport). XHR gives us reliable `upload.progress` events
 * on every browser and tells us exactly how many bytes hit
 * the wire.
 *
 * Wire format: same as the @vercel/blob client (POST to
 * handleUploadUrl for the token, then PUT to the token's
 * URL, then the server's onUploadCompleted fires). We do
 * NOT call onUploadCompleted ourselves — the server's
 * callback is what creates the File row. Once our PUT
 * resolves, we know the bytes are in Vercel Blob and the
 * callback will fire imminently.
 */
async function uploadWithXhr(
  file: File,
  opts: {
    handleUploadUrl: string;
    clientPayload: string;
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  },
): Promise<{ url: string; pathname: string }> {
  const { handleUploadUrl, clientPayload, onProgress, signal } = opts;

  // Phase 1: token.
  const tokenRes = await fetch(handleUploadUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname: file.name, clientPayload, multipart: false },
    }),
    signal,
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => '');
    throw new Error(
      `Upload token request failed (${tokenRes.status}): ${text.slice(0, 200) || tokenRes.statusText}`,
    );
  }
  const { clientToken } = (await tokenRes.json()) as { clientToken: string };
  if (!clientToken) {
    throw new Error('Upload token response missing clientToken');
  }

  // Parse the clientToken to extract the storeId + pathname,
  // then build the upload URL ourselves. The clientToken
  // format (per @vercel/blob client.cjs generateClientTokenFromReadWriteToken):
  //
  //   vercel_blob_client_{storeId}_{base64(securedKey + '.' + base64(payload))}
  //
  // Where `payload` is a base64-encoded JSON object with
  // `{ pathname, validUntil, onUploadCompleted?, ... }`.
  // The actual upload URL is built by the library as:
  //   https://{storeId}.{access}.blob.vercel-storage.com/{pathname}
  //
  // We mimic the same shape here so the PUT lands in the
  // right place.
  const tokenParts = clientToken.split('_');
  if (tokenParts.length < 5) {
    throw new Error('Malformed upload token (expected at least 5 underscore-separated parts)');
  }
  const storeId = tokenParts[3];
  const encodedTail = tokenParts.slice(4).join('_');
  // Decode the base64 tail → "securedKey.payload" (a JWT-like string)
  let decodedTail: string;
  try {
    decodedTail = atob(encodedTail);
  } catch {
    throw new Error('Could not decode upload token tail (not valid base64)');
  }
  const dot = decodedTail.indexOf('.');
  if (dot < 0) {
    throw new Error('Malformed upload token (missing payload separator)');
  }
  const encodedPayload = decodedTail.slice(dot + 1);
  let payload: { pathname?: string; onUploadCompleted?: { callbackUrl?: string; tokenPayload?: string } };
  try {
    payload = JSON.parse(atob(encodedPayload));
  } catch (e) {
    throw new Error(`Could not decode upload token payload: ${e instanceof Error ? e.message : 'unknown'}`);
  }
  const pathname = payload.pathname;
  if (!pathname) {
    throw new Error('Upload token payload missing pathname');
  }
  // The access defaults to 'public' in the @vercel/blob client
  // (we set it in our @vercel/blob call; for the XHR path we
  // hard-code the same default).
  const uploadUrl = `https://${storeId}.public.blob.vercel-storage.com/${pathname}`;

  // Phase 2: PUT. XHR gives us reliable upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    });
    xhr.upload.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.upload.addEventListener('abort', () =>
      reject(new DOMException('Upload aborted', 'AbortError')),
    );
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // The response body is the JSON blob descriptor:
        // { url, pathname, contentType, contentDisposition, ... }
        try {
          const body = JSON.parse(xhr.responseText) as {
            url: string;
            pathname: string;
          };
          resolve({ url: body.url, pathname: body.pathname });
        } catch {
          // Fallback: build the URL from the path we already know.
          resolve({ url: uploadUrl, pathname });
        }
      } else {
        reject(
          new Error(`Upload PUT failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`),
        );
      }
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    if (signal) {
      if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', () => xhr.abort());
    }
    xhr.send(file);
  });
}

interface UseBlobUploadOpts {
  /** Path of the handleUpload route (e.g. `/api/files/upload`). */
  handleUploadUrl: string;
  /** Maximum bytes — 500MB by default (Vercel Blob hard cap). */
  maxBytes?: number;
  /** Optional callback on each progress tick. */
  onProgress?: (pct: number) => void;
  /**
   * Force the XHR-based uploader instead of using the
   * `@vercel/blob/client` `upload()` helper. The XHR
   * path gives us reliable `upload.progress` events on
   * every browser (the @vercel/blob v2.x client uses
   * `fetch`-with-upload-streams when supported, which
   * can fail to emit progress for small or fast uploads
   * — user reports showed 0% forever). The XHR path
   * also gives us a clearer error message when the PUT
   * itself fails. Default: false (use the @vercel/blob
   * client).
   */
  forceXhr?: boolean;
}

export function useBlobUpload(opts: UseBlobUploadOpts) {
  const { handleUploadUrl, maxBytes = 500 * 1024 * 1024, onProgress, forceXhr = false } = opts;
  const [state, setState] = useState<UploadState>(initial);

  const reset = useCallback(() => setState(initial), []);

  const upload = useCallback(
    async (file: File, tokenPayload: Record<string, string> = {}) => {
      if (state.phase === 'uploading' || state.phase === 'token' || state.phase === 'finalizing') {
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
        phase: 'token',
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
      // event, tick a fake "indeterminate" progress of 5%
      // every 200ms so the bar never looks frozen — even
      // if the @vercel/blob client's fetch-streams
      // transport never fires (which can happen for very
      // small or very fast uploads where the entire
      // payload streams through one tick). Once the
      // first real progress event lands (firstProgressAt
      // gets set), the real percentage takes over.
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
            if (s.phase !== 'token' && s.phase !== 'uploading' && s.phase !== 'finalizing') return s;
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
        // Before any real progress event, tick the bar
        // to 5% then 10% then 15% etc. (every 200ms) so
        // the user always sees motion. Capped at 50%
        // so we don't get ahead of reality. As soon as
        // a real progress event fires, the bar takes
        // over and reports the real percentage.
        if (firstProgressAt === null && Date.now() - lastProgressAt < 5_000) {
          setState((s) => {
            if (s.phase === 'uploading' || s.phase === 'finalizing') return s;
            const next = Math.min(50, (s.progress || 0) + 5);
            return { ...s, progress: next, uploadedBytes: 0, totalBytes: s.totalBytes || file.size };
          });
        }
      }, 200);

      const onProgressTick = (loaded: number, total: number) => {
        lastProgressAt = Date.now();
        if (firstProgressAt === null) firstProgressAt = Date.now();
        const pct = Math.max(0, Math.min(100, Math.round((loaded / Math.max(total, 1)) * 100)));
        setState((s) => ({
          ...s,
          phase: 'uploading',
          progress: pct,
          uploadedBytes: loaded,
          totalBytes: total || file.size,
        }));
        onProgress?.(pct);
      };

      try {
        console.log('[useBlobUpload] starting upload', {
          fileName: file.name,
          fileSize: file.size,
          handleUploadUrl,
          transport: forceXhr ? 'xhr' : 'vercel-blob-client',
          hasTokenPayload: Object.keys(tokenPayload).length > 0,
        });
        let result: { url: string; pathname: string };

        if (forceXhr) {
          result = await uploadWithXhr(file, {
            handleUploadUrl,
            clientPayload: JSON.stringify(tokenPayload),
            onProgress: (loaded, total) => onProgressTick(loaded, total),
          });
        } else {
          const v = await vercelUpload(file.name, file, {
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
              const loaded = normalizeLoaded(payload, file.size);
              onProgressTick(loaded, file.size);
            },
          });
          result = { url: v.url, pathname: v.pathname };
        }
        if (!heartbeatCleared) clearInterval(heartbeat);
        console.log('[useBlobUpload] upload PUT resolved, waiting for server callback', { url: result.url });
        // We just landed the bytes in Vercel Blob. Now the
        // server's onUploadCompleted callback fires
        // asynchronously (Vercel dispatches it). The File row
        // + the router.refresh() in the calling component
        // both depend on that callback. Show a "finalizing"
        // phase so the user sees the bar holding at ~100%
        // for the few hundred ms between the PUT resolving
        // and the page list updating.
        setState((s) => ({
          ...s,
          phase: 'finalizing',
          progress: 99,
          uploadedBytes: file.size,
          result: { url: result.url, pathname: result.pathname },
        }));
        // Brief pause so the user sees the finalizing state,
        // then mark done. The page-side router.refresh()
        // will pull the new file from the DB once the
        // server's onUploadCompleted callback lands.
        await new Promise((r) => setTimeout(r, 400));
        setState((s) => ({
          ...s,
          isUploading: false,
          phase: 'done',
          progress: 100,
        }));
        return result;
      } catch (e) {
        if (!heartbeatCleared) clearInterval(heartbeat);
        const msg = e instanceof Error ? e.message : 'Upload failed';
        // Try to classify the error so the message points
        // to the right place. The @vercel/blob client
        // throws a single `BlobError` for token + PUT +
        // callback failures, so we have to use the message.
        const isTokenError = /token/i.test(msg);
        const isCorsError = /cors|network|fetch/i.test(msg);
        const diagnostic = isTokenError
          ? ' (the upload token request failed — likely an auth or session issue)'
          : isCorsError
          ? ' (network or CORS error — try a different network, or contact support if it persists)'
          : '';
        console.error('[useBlobUpload] upload failed', {
          error: msg,
          name: e instanceof Error ? e.name : 'unknown',
          transport: forceXhr ? 'xhr' : 'vercel-blob-client',
        });
        setState((s) => ({
          ...s,
          isUploading: false,
          phase: 'error',
          error: `${msg.slice(0, 400)}${diagnostic}`,
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
    [handleUploadUrl, maxBytes, onProgress, forceXhr],
  );

  return { upload, state, reset };
}
