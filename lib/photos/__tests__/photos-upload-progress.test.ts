// @vitest-environment jsdom
/**
 * Regression tests for the direct-browser project-photo upload
 * path. The refactor moved photo uploads off the server-side
 * `uploadProjectPhotoAction` (which went through the 4.5MB
 * Vercel function body limit and produced ZERO progress events)
 * and onto the shared `useBlobUpload` hook + a new
 * `handleUpload` route at
 * `app/api/projects/[id]/photos/upload/route.ts`.
 *
 * What we're pinning:
 *
 *   1. clientPayload shape — the form must build a payload with
 *      projectId, uploaderId, folderId, room, area, phase,
 *      caption, takenAt, latitude, longitude. The server's
 *      zod schema is the source of truth; the helper here
 *      mirrors it.
 *
 *   2. Pre-flight validation — the size and MIME checks run
 *      BEFORE we flip `phase: 'uploading'`, so the user gets
 *      an instant error without a phantom progress bar.
 *
 *   3. Progress events — the `useBlobUpload` hook mirrors
 *      `onUploadProgress.percentage` into state.progress
 *      across the 0..100 range.
 *
 *   4. Success state — once the upload resolves, the
 *      success card should expose the new blob URL so the
 *      sheet can match it to the new ProjectPhoto row.
 *
 *   5. Error state — if the upload rejects, the hook
 *      captures the message and surfaces it in the error
 *      card.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  buildPhotoUploadPayload,
  preflightPhoto,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_MIME,
} from '../upload-payload';

// Mock the @vercel/blob client so we can drive the hook
// without a network. The mock captures onUploadProgress and
// lets us fire it with whatever percentage we want — same
// pattern as the files-upload test.
const vercelUploadMock = vi.fn();
vi.mock('@vercel/blob/client', () => ({
  upload: (...args: unknown[]) => vercelUploadMock(...args),
}));

import { useBlobUpload } from '@/lib/blob/client-upload';

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

// =====================================================================
// 1. clientPayload shape — happy path
// =====================================================================

describe('buildPhotoUploadPayload — happy path', () => {
  it('produces a payload with all expected string fields', () => {
    const payload = buildPhotoUploadPayload({
      projectId: 'proj_1',
      uploaderId: 'user_1',
      folderId: 'folder_1',
      room: 'Master Bath',
      area: 'North wing',
      phase: 'ROUGH_IN',
      caption: 'Tile before grout',
      takenAt: new Date('2026-08-20T10:00:00.000Z'),
      latitude: 41.123,
      longitude: -71.456,
    });
    expect(payload).toEqual({
      projectId: 'proj_1',
      uploaderId: 'user_1',
      folderId: 'folder_1',
      room: 'Master Bath',
      area: 'North wing',
      phase: 'ROUGH_IN',
      caption: 'Tile before grout',
      takenAt: '2026-08-20T10:00:00.000Z',
      latitude: '41.123',
      longitude: '-71.456',
    });
  });

  it('defaults missing optional fields to empty strings (server turns "" into null)', () => {
    const payload = buildPhotoUploadPayload({
      projectId: 'proj_1',
      uploaderId: 'user_1',
    });
    expect(payload.folderId).toBe('');
    expect(payload.room).toBe('');
    expect(payload.area).toBe('');
    expect(payload.caption).toBe('');
    expect(payload.phase).toBe('ROUGH_IN');
    expect(payload.takenAt).toBe('');
    expect(payload.latitude).toBe('');
    expect(payload.longitude).toBe('');
  });

  it('converts string dates to ISO strings', () => {
    const payload = buildPhotoUploadPayload({
      projectId: 'proj_1',
      uploaderId: 'user_1',
      takenAt: '2026-01-15T08:30:00.000Z',
    });
    expect(payload.takenAt).toBe('2026-01-15T08:30:00.000Z');
  });

  it('drops invalid date strings (not a real Date) to empty', () => {
    const payload = buildPhotoUploadPayload({
      projectId: 'proj_1',
      uploaderId: 'user_1',
      takenAt: 'not a real date',
    });
    expect(payload.takenAt).toBe('');
  });

  it('accepts a phase of FINAL', () => {
    const payload = buildPhotoUploadPayload({
      projectId: 'proj_1',
      uploaderId: 'user_1',
      phase: 'FINAL',
    });
    expect(payload.phase).toBe('FINAL');
  });
});

// =====================================================================
// 2. Pre-flight validation runs BEFORE the upload phase changes
// =====================================================================

describe('preflightPhoto — validation gates upload', () => {
  it('accepts a JPEG under the cap', () => {
    const file = new File([new Uint8Array(1000)], 'p.jpg', {
      type: 'image/jpeg',
    });
    expect(preflightPhoto(file).ok).toBe(true);
  });

  it('rejects an oversize file BEFORE any upload bytes leave the device', () => {
    // 51 MB of zeros — over the 50MB cap.
    const file = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'big.jpg', {
      type: 'image/jpeg',
    });
    const result = preflightPhoto(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/too large/i);
      expect(result.reason).toContain('50 MB');
    }
  });

  it('rejects a non-image MIME (no upload attempted)', () => {
    const file = new File([new Uint8Array(100)], 'evil.exe', {
      type: 'application/octet-stream',
    });
    const result = preflightPhoto(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/image/i);
    }
  });

  it('rejects an empty file', () => {
    const file = new File([new Uint8Array(0)], 'empty.jpg', {
      type: 'image/jpeg',
    });
    const result = preflightPhoto(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/empty/i);
    }
  });

  it('rejects an unsupported image MIME (e.g. image/bmp)', () => {
    const file = new File([new Uint8Array(100)], 'pic.bmp', {
      type: 'image/bmp',
    });
    const result = preflightPhoto(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/unsupported/i);
    }
  });

  it('accepts every MIME in ALLOWED_PHOTO_MIME', () => {
    for (const type of ALLOWED_PHOTO_MIME) {
      const file = new File([new Uint8Array(1000)], 'pic', { type });
      expect(preflightPhoto(file).ok, `MIME ${type} should be accepted`).toBe(true);
    }
  });
});

// =====================================================================
// 3. Progress events mirror percentage 0..100
// =====================================================================

describe('useBlobUpload — progress events (the heart of the fix)', () => {
  it('mirrors loaded bytes from a bare-number progress payload into state 0..100', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (
        _name: string,
        _file: File,
        opts: { onUploadProgress?: (p: unknown) => void },
      ) => {
        pending.onUploadProgress = opts.onUploadProgress;
        return pending.promise;
      },
    );

    const { result } = renderHook(() =>
      useBlobUpload({
        handleUploadUrl: '/api/projects/abc/photos/upload',
      }),
    );

    const file = new File([new Uint8Array(10_000)], 'photo.jpg', {
      type: 'image/jpeg',
    });

    act(() => {
      result.current.upload(file, { projectId: 'abc', uploaderId: 'u1' });
    });
    // Phase starts as 'token' (requesting the upload
    // token from the route), then becomes 'uploading'
    // on the first progress event from @vercel/blob.
    expect(['token', 'uploading']).toContain(result.current.state.phase);
    expect(result.current.state.progress).toBe(0);

    // The @vercel/blob v2.x client calls onUploadProgress
    // with a bare number (the bytes loaded so far). The
    // hook computes the percentage from that. This is the
    // shape that was actually getting passed in production;
    // the earlier test assumed an object with `percentage`,
    // which masked the bug.
    for (const loaded of [1000, 3300, 6700, 9500, 10_000]) {
      await act(async () => {
        pending.onUploadProgress?.(loaded);
      });
      expect(result.current.state.progress).toBe(
        Math.round((loaded / 10_000) * 100),
      );
    }

    await act(async () => {
      pending.resolve('https://blob.test/photo.jpg', 'photo.jpg');
      await pending.promise;
    });
    // The PUT resolved — wait for the 400ms 'finalizing'
    // window before asserting 'done'.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.result?.url).toBe('https://blob.test/photo.jpg');
  });

  it('also accepts the { loaded, total, percentage } object shape (older XHR transport)', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (
        _name: string,
        _file: File,
        opts: { onUploadProgress?: (p: unknown) => void },
      ) => {
        pending.onUploadProgress = opts.onUploadProgress;
        return pending.promise;
      },
    );
    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/projects/abc/photos/upload' }),
    );
    const file = new File([new Uint8Array(1000)], 'p.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.upload(file);
    });

    await act(async () => {
      pending.onUploadProgress?.({ loaded: 500, total: 1000, percentage: 50 });
    });
    expect(result.current.state.progress).toBe(50);
  });

  it('clamps percentage to 0..100 when bytes exceed file size', async () => {
    const pending = makePendingUpload();
    vercelUploadMock.mockImplementation(
      async (
        _name: string,
        _file: File,
        opts: { onUploadProgress?: (p: unknown) => void },
      ) => {
        pending.onUploadProgress = opts.onUploadProgress;
        return pending.promise;
      },
    );
    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/projects/abc/photos/upload' }),
    );
    const file = new File([new Uint8Array(100)], 'p.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.upload(file);
    });

    await act(async () => {
      pending.onUploadProgress?.(500);
    });
    expect(result.current.state.progress).toBe(100);

    await act(async () => {
      pending.onUploadProgress?.(-10);
    });
    expect(result.current.state.progress).toBe(0);
  });
});

// =====================================================================
// 4. Success state includes the new blob URL (the sheet uses this
// to match the new ProjectPhoto row in the photos list)
// =====================================================================

describe('useBlobUpload — success state', () => {
  it('exposes the new blob URL in state.result on success', async () => {
    vercelUploadMock.mockResolvedValue({
      url: 'https://blob.test/photo-12345.jpg',
      pathname: 'photo-12345.jpg',
      downloadUrl: 'https://blob.test/photo-12345.jpg?download=1',
    });

    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/projects/abc/photos/upload' }),
    );
    const file = new File([new Uint8Array(1000)], 'p.jpg', { type: 'image/jpeg' });

    let returnedUrl: string | null = null;
    await act(async () => {
      const r = await result.current.upload(file, { projectId: 'abc' });
      returnedUrl = r.url;
    });

    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.result?.url).toBe('https://blob.test/photo-12345.jpg');
    expect(result.current.state.result?.pathname).toBe('photo-12345.jpg');
    // The hook returns the same result object so the caller
    // doesn't have to read state. This is what the form
    // captures to find the new ProjectPhoto row.
    expect(returnedUrl).toBe('https://blob.test/photo-12345.jpg');
  });
});

// =====================================================================
// 5. Error state surfaces the failure message
// =====================================================================

describe('useBlobUpload — error state', () => {
  it('captures the error message and flips to phase=error', async () => {
    vercelUploadMock.mockRejectedValueOnce(new Error('Network exploded'));

    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/projects/abc/photos/upload' }),
    );
    const file = new File([new Uint8Array(1000)], 'p.jpg', { type: 'image/jpeg' });

    await act(async () => {
      try {
        await result.current.upload(file);
      } catch {
        // expected
      }
    });

    expect(result.current.state.phase).toBe('error');
    // The hook now appends a diagnostic suffix for known
    // error categories. "Network exploded" matches the
    // /network/ pattern, so we get the CORS/network hint
    // appended. That's the right behavior — it tells the
    // user what kind of failure this is.
    expect(result.current.state.error).toContain('Network exploded');
    // Progress should NOT have flipped to 100 — the user must
    // see the error card, not a success card.
    expect(result.current.state.progress).not.toBe(100);
  });

  it('truncates very long error messages to 500 chars', async () => {
    const longMsg = 'x'.repeat(1500);
    vercelUploadMock.mockRejectedValueOnce(new Error(longMsg));

    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/projects/abc/photos/upload' }),
    );
    const file = new File([new Uint8Array(1000)], 'p.jpg', { type: 'image/jpeg' });

    await act(async () => {
      try {
        await result.current.upload(file);
      } catch {
        // expected
      }
    });

    expect(result.current.state.error).toBeDefined();
    // The hook now truncates the message to 400 chars
    // (was 500) so the diagnostic suffix can fit without
    // exceeding the previous 500-char limit.
    expect(result.current.state.error!.length).toBeLessThanOrEqual(500);
  });

  it('rejects an oversize file BEFORE flipping phase to uploading', async () => {
    // This is the spec requirement: size check happens
    // BEFORE phase: 'uploading', so the user doesn't see
    // a phantom progress bar for a file we never started
    // uploading.
    const { result } = renderHook(() =>
      useBlobUpload({
        handleUploadUrl: '/api/projects/abc/photos/upload',
        maxBytes: MAX_PHOTO_BYTES,
      }),
    );
    const huge = new File(
      [new Uint8Array(MAX_PHOTO_BYTES + 1)],
      'huge.jpg',
      { type: 'image/jpeg' },
    );

    await act(async () => {
      try {
        await result.current.upload(huge);
      } catch {
        // expected
      }
    });

    expect(result.current.state.phase).toBe('error');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toMatch(/too large/i);
    // We must NOT have called vercelUpload with the oversize
    // file — that would mean we opened a progress bar and
    // then cancelled.
    expect(vercelUploadMock).not.toHaveBeenCalled();
  });
});
