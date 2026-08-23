/**
 * Regression test for the service worker.
 *
 * The SW is plain JavaScript that runs in a browser context
 * (uses `self.addEventListener`), so we can't actually execute
 * it under Node. Instead, we read the file as text and assert
 * on its structure. This catches the most likely regression:
 * a future change that lets RSC requests fall through to the
 * cache-first branch (which is what caused the "uploaded
 * photo doesn't show up" bug this test exists to prevent).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const swSource = readFileSync(resolve(__dirname, '../sw.js'), 'utf8');

describe('service worker — request routing', () => {
  it('handles RSC (router.refresh) requests network-first, no cache', () => {
    // The bug this test exists to prevent: RSC requests
    // (sent by Next.js router.refresh() after mutations
    // like photo uploads) have `accept: text/x-component`
    // and an `RSC: 1` header. If those fall through to the
    // static-assets branch (cache-first), the user sees
    // stale data after every upload.
    expect(swSource).toMatch(/accept.*text\/x-component/);
    expect(swSource).toMatch(/headers\.get\(['"]rsc['"]\)/);
    // RSC responses must NOT be cached — they're per-request.
    expect(swSource).toMatch(/if\s*\(\s*isHtml\s*\)\s*\{[\s\S]*c\.put/);
  });

  it('handles HTML page requests network-first (no HTML cache to avoid stale bundles)', () => {
    // The previous behavior was network-first with cache fallback
    // for HTML, but that caused "Server Components render" errors
    // when a new deploy shipped — the SW served the OLD cached
    // HTML whose JS bundle hashes no longer existed on the
    // server. The fix is network-only for HTML (the app shell
    // is still cached for offline cold-start).
    expect(swSource).toMatch(/accept.*text\/html/);
    // The HTML branch must NOT cache the response
    const htmlSection = swSource.match(/isHtml[\s\S]{0,400}/);
    expect(htmlSection?.[0]).not.toMatch(/c\.put\(request, copy\)/);
  });

  it('handles API routes network-first with offline JSON fallback', () => {
    expect(swSource).toMatch(/url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
    expect(swSource).toMatch(/offline.*true/);
  });

  it('handles static assets cache-first', () => {
    expect(swSource).toMatch(/caches\.match\(request\)\.then\(\(cached\)/);
  });

  it('skips non-GET requests (POST, PUT, DELETE pass through)', () => {
    expect(swSource).toMatch(/request\.method\s*!==\s*['"]GET['"]/);
  });

  it('skips cross-origin requests (let the browser handle them)', () => {
    expect(swSource).toMatch(/url\.origin\s*!==\s*self\.location\.origin/);
  });
});

describe('service worker — cache versioning', () => {
  it('declares a CACHE_VERSION constant', () => {
    // The version can be either a fixed number (udgok-v3) or
    // a content-derived version (udgok-v4-<sha>-<date>) — the
    // scripts/sync-sw-cache-version.sh build hook writes the
    // latter for every deploy so we never ship a new build
    // without invalidating the cache.
    expect(swSource).toMatch(/const\s+CACHE_VERSION\s*=\s*['"]udgok-v[\w-]+['"]/);
  });

  it('deletes old caches on activate', () => {
    // Bumping CACHE_VERSION should trigger a cleanup of
    // all caches not starting with the new version.
    expect(swSource).toMatch(/filter\(\(k\)\s*=>\s*!k\.startsWith\(CACHE_VERSION\)\)/);
  });

  it('uses skipWaiting + clients.claim for fast activation', () => {
    expect(swSource).toMatch(/self\.skipWaiting\(\)/);
    expect(swSource).toMatch(/self\.clients\.claim\(\)/);
  });
});
