// @vitest-environment jsdom
/**
 * Regression tests for the useBlobUpload hook.
 *
 * The hook powers every direct-browser → Vercel Blob upload
 * in the app (workspace files, client files, BIM models, scan
 * product photos, etc.). Two properties are worth pinning:
 *
 *   1. Progress callbacks. The @vercel/blob client passes a
 *      `percentage` field on every progress event. The hook
 *      should mirror it into state. The bug to prevent: a
 *      stale closure on `state.phase` (or any other captured
 *      value) causing the callback to use the wrong percentage
 *      or skip the update.
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
// lets us fire it with whatever percentage we want.
const vercelUploadMock = vi.fn();
vi.mock('@vercel/blob/client', () => ({
  upload: (...args: unknown[]) => vercelUploadMock(...args),
}));

import { useBlobUpload } from '../client-upload';

beforeEach(() => {
  vercelUploadMock.mockReset();
});

function makePendingUpload(percentage = 0) {
  // The @vercel/blob client returns this shape. We resolve
  // the promise later so we can fire progress events in
  // between.
  let resolve!: (value: { url: string; pathname: string }) => void;
  const promise = new Promise<{ url: string; pathname: string }>((r) => {
    resolve = r;
  });
  return {
    promise,
    resolve: (url = 'https://blob.test/abc.jpg', pathname = 'abc.jpg') =>
      resolve({ url, pathname }),
    onUploadProgress: undefined as
      | ((p: { percentage: number }) => void)
      | undefined,
  };
}

describe('useBlobUpload — progress events', () => {
  it('mirrors percentage from onUploadProgress into state', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (
        _name: string,
        _file: File,
        opts: { onUploadProgress?: (p: { percentage: number }) => void },
      ) => {
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
    expect(result.current.state.phase).toBe('uploading');
    expect(result.current.state.progress).toBe(0);

    // Fire a 25% progress event.
    await act(async () => {
      pending.onUploadProgress?.({ percentage: 25 });
    });
    expect(result.current.state.progress).toBe(25);
    expect(result.current.state.uploadedBytes).toBe(250);
    expect(result.current.state.totalBytes).toBe(1000);

    // Fire a 75% progress event.
    await act(async () => {
      pending.onUploadProgress?.({ percentage: 75 });
    });
    expect(result.current.state.progress).toBe(75);
    expect(result.current.state.uploadedBytes).toBe(750);

    // Resolve the upload.
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.progress).toBe(100);
  });

  it('clamps percentage to 0..100 even if the library passes garbage', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (
        _name: string,
        _file: File,
        opts: { onUploadProgress?: (p: { percentage: number }) => void },
      ) => {
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

    await act(async () => {
      pending.onUploadProgress?.({ percentage: 150 });
    });
    expect(result.current.state.progress).toBe(100);

    await act(async () => {
      pending.onUploadProgress?.({ percentage: -10 });
    });
    expect(result.current.state.progress).toBe(0);

    await act(async () => {
      pending.onUploadProgress?.({ percentage: 0 });
    });
    expect(result.current.state.progress).toBe(0);
  });
});

describe('useBlobUpload — callback stability', () => {
  it('returns a stable upload function across re-renders', async () => {
    // Pin the regression where state.phase was in the
    // dependency array, causing the callback to re-create on
    // every phase change. The bug: re-renders mid-upload
    // re-mounted the form with a new upload function, which
    // captured the new state.phase, which made the guard
    // `state.phase === 'uploading'` spuriously true and threw
    // "Upload already in progress" on re-entry.
    const { result, rerender } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/files/upload' }),
    );
    const first = result.current.upload;
    rerender();
    expect(result.current.upload).toBe(first);
  });
});
