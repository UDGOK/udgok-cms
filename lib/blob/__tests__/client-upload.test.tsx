// @vitest-environment jsdom
/**
 * Regression tests for the useBlobUpload hook.
 *
 * The hook powers every direct-browser → Vercel Blob upload
 * in the app (workspace files, client files, BIM models, scan
 * product photos, etc.). Two properties are worth pinning:
 *
 *   1. Progress callbacks. The @vercel/blob client passes
 *      a bare number (the bytes loaded) — NOT an object
 *      with a `percentage` field. The hook should compute
 *      the percentage itself from the known file size.
 *      Earlier versions destructured `{ percentage }` and
 *      got `undefined` every time, which clamped progress
 *      to 0% and made the bar look stuck. We test both
 *      the bare-number shape (the real library behavior)
 *      and the object shape (older XHR transports).
 *
 *   2. Callback stability. The `upload` function is exposed
 *      through useCallback. Putting `state.phase` in the
 *      dependency array was tempting (it guards against
 *      re-entrant uploads) but it caused the callback to
 *      re-create on every phase change, which in turn caused
 *      spurious "Upload already in progress" errors and
 *      double-progress updates. The test pins the new stable
 *      identity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the @vercel/blob client so we can drive the hook
// without a network. The mock captures onUploadProgress and
// lets us fire it with whatever payload shape we want.
const vercelUploadMock = vi.fn();
vi.mock('@vercel/blob/client', () => ({
  upload: (...args: unknown[]) => vercelUploadMock(...args),
}));

import { useBlobUpload } from '../client-upload';

beforeEach(() => {
  vercelUploadMock.mockReset();
});

function makePendingUpload() {
  let resolve!: (value: { url: string; pathname: string }) => void;
  const promise = new Promise<{ url: string; pathname: string }>((r) => {
    resolve = r;
  });
  return {
    promise,
    resolve: (url = 'https://blob.test/abc.jpg', pathname = 'abc.jpg') =>
      resolve({ url, pathname }),
    onUploadProgress: undefined as ((p: unknown) => void) | undefined,
  };
}

describe('useBlobUpload — progress events (real library shape)', () => {
  // The @vercel/blob v2.x client calls onUploadProgress
  // with a bare number (the bytes loaded so far). The
  // previous version of this hook destructured `{ percentage }`
  // and got `undefined` — clamping the bar to 0% forever.
  // This test pins the corrected behavior.
  it('computes percentage from a bare-number progress payload', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (_name: string, _file: File, opts: { onUploadProgress?: (p: unknown) => void }) => {
        pending.onUploadProgress = opts.onUploadProgress;
        return pending.promise;
      },
    );

    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/files/upload' }),
    );

    const file = new File([new Uint8Array(1000)], 'test.pdf', {
      type: 'application/pdf',
    });

    act(() => {
      result.current.upload(file, { workspaceId: 'w1' });
    });
    // Phase starts as 'token' (requesting the upload
    // token from the route), then becomes 'uploading'
    // on the first progress event from @vercel/blob.
    expect(['token', 'uploading']).toContain(result.current.state.phase);
    expect(result.current.state.progress).toBe(0);

    // 25% loaded (250 / 1000) — the library passes a bare
    // number, NOT an object.
    await act(async () => {
      pending.onUploadProgress?.(250);
    });
    expect(result.current.state.progress).toBe(25);
    expect(result.current.state.uploadedBytes).toBe(250);
    expect(result.current.state.totalBytes).toBe(1000);

    await act(async () => {
      pending.onUploadProgress?.(750);
    });
    expect(result.current.state.progress).toBe(75);
    expect(result.current.state.uploadedBytes).toBe(750);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    // The PUT resolved, so we land in 'finalizing' for a
    // brief moment while we wait for the server's
    // onUploadCompleted callback. Wait for the final 'done'
    // transition (the hook waits 400ms to give the server
    // callback time to land before flipping state).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.progress).toBe(100);
  });

  it('also handles the { loaded, total, percentage } object shape (older XHR transport)', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (_name: string, _file: File, opts: { onUploadProgress?: (p: unknown) => void }) => {
        pending.onUploadProgress = opts.onUploadProgress;
        return pending.promise;
      },
    );

    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/files/upload' }),
    );
    const file = new File([new Uint8Array(1000)], 'x.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.upload(file);
    });

    await act(async () => {
      pending.onUploadProgress?.({ loaded: 500, total: 1000, percentage: 50 });
    });
    expect(result.current.state.progress).toBe(50);
    expect(result.current.state.uploadedBytes).toBe(500);
  });

  it('clamps percentage to 0..100 when bytes exceed file size', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (_name: string, _file: File, opts: { onUploadProgress?: (p: unknown) => void }) => {
        pending.onUploadProgress = opts.onUploadProgress;
        return pending.promise;
      },
    );

    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/files/upload' }),
    );
    const file = new File([new Uint8Array(100)], 'x.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.upload(file);
    });

    // Library sometimes over-reports loaded bytes (rounding
    // in the chunk transform). Clamp to 100% rather than
    // showing 150% in the UI.
    await act(async () => {
      pending.onUploadProgress?.(500);
    });
    expect(result.current.state.progress).toBe(100);

    await act(async () => {
      pending.onUploadProgress?.(-50);
    });
    expect(result.current.state.progress).toBe(0);
  });

  it('falls back to file size on a totally unknown payload shape', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (_name: string, _file: File, opts: { onUploadProgress?: (p: unknown) => void }) => {
        pending.onUploadProgress = opts.onUploadProgress;
        return pending.promise;
      },
    );

    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/files/upload' }),
    );
    const file = new File([new Uint8Array(1000)], 'x.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.upload(file);
    });

    await act(async () => {
      pending.onUploadProgress?.('garbage');
    });
    // Fall back to file size → 100%.
    expect(result.current.state.progress).toBe(100);
  });
});

describe('useBlobUpload — callback stability', () => {
  it('returns a stable upload function across re-renders', async () => {
    const { result, rerender } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/files/upload' }),
    );
    const first = result.current.upload;
    rerender();
    expect(result.current.upload).toBe(first);
  });
});
