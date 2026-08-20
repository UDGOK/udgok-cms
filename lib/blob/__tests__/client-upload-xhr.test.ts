/**
 * XHR transport tests for useBlobUpload.
 *
 * The XHR path is the fallback for the @vercel/blob
 * client's fetch-with-upload-streams transport, which can
 * fail to fire progress events for small/fast uploads
 * (user reported 0% progress that never advances).
 *
 * These tests verify the clientToken parsing + URL
 * construction logic without actually making network
 * calls (we mock the fetch + XHR).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// @vitest-environment jsdom

// Mock XMLHttpRequest to a controllable stub
class XhrMock {
  static instances: XhrMock[] = [];
  static reset() { XhrMock.instances = []; }
  upload: { addEventListener: (e: string, fn: (...a: unknown[]) => void) => void } = {
    addEventListener: () => {},
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  method = '';
  url = '';
  body: unknown = null;
  headers: Record<string, string> = {};
  status = 200;
  responseText = '';
  addEventListener() {}
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  send(body: unknown) { this.body = body; }
  // Helpers
  triggerProgress(loaded: number, total: number) {
    // jsdom doesn't fire this naturally. We call listeners
    // directly through the mock.
    (this as unknown as { _progressHandlers: Array<(e: { lengthComputable: boolean; loaded: number; total: number }) => void> })._progressHandlers ||= [];
    for (const fn of (this as unknown as { _progressHandlers: Array<(e: { lengthComputable: boolean; loaded: number; total: number }) => void> })._progressHandlers) {
      fn({ lengthComputable: true, loaded, total });
    }
  }
  triggerLoad(status: number, body: string) {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }
}

beforeEach(() => {
  XhrMock.reset();
  (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = function () {
    const m = new XhrMock();
    XhrMock.instances.push(m);
    return m;
  };
});

afterEach(() => {
  delete (global as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest;
});

describe('useBlobUpload — XHR transport', () => {
  it('parses clientToken to extract storeId + pathname and PUTs to the right URL', async () => {
    // The clientToken format: vercel_blob_client_{storeId}_{base64(key.payload)}
    // where payload is base64(JSON) with { pathname, validUntil, ... }
    const payload = JSON.stringify({
      pathname: 'test-folder/test-file.pdf',
      validUntil: Date.now() + 60_000,
    });
    const tail = 'signedKey.' + Buffer.from(payload).toString('base64');
    const encodedTail = Buffer.from(tail).toString('base64');
    const clientToken = `vercel_blob_client_storeAbCdEf12345_${encodedTail}`;

    // Mock the token-fetch response
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clientToken }),
    });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    const { useBlobUpload } = await import('../client-upload');
    const { result } = renderHook(() =>
      useBlobUpload({ handleUploadUrl: '/api/files/upload', forceXhr: true }),
    );

    const file = new File([new Uint8Array(1000)], 'test.pdf', { type: 'application/pdf' });
    // Don't await — we'll fire the PUT completion separately
    const uploadPromise = act(async () => {
      await result.current.upload(file, { workspaceId: 'ws_1' });
    });

    // Wait a tick for the token fetch to settle
    await new Promise((r) => setTimeout(r, 10));

    // The XHR should have been constructed
    expect(XhrMock.instances.length).toBe(1);
    const xhr = XhrMock.instances[0];
    // The URL should be https://storeAbCdEf12345.public.blob.vercel-storage.com/test-folder/test-file.pdf
    expect(xhr.url).toBe('https://storeAbCdEf12345.public.blob.vercel-storage.com/test-folder/test-file.pdf');
    expect(xhr.method).toBe('PUT');
    // The body should be the file
    expect(xhr.body).toBe(file);

    // Trigger the PUT completion
    await act(async () => {
      xhr.triggerLoad(200, JSON.stringify({
        url: 'https://storeAbCdEf12345.public.blob.vercel-storage.com/test-folder/test-file.pdf',
        pathname: 'test-folder/test-file.pdf',
      }));
    });

    // Wait for the upload promise to resolve
    await uploadPromise;

    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.progress).toBe(100);
  });
});
