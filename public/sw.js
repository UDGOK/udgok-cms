// UDGOK CMS service worker — enables PWA install + offline app shell.
//
// IMPORTANT: bump CACHE_VERSION on every deploy that changes the
// client bundle. Vercel rewrites the static URL with a content
// hash so the browser will pick up the new file when we change
// this string, but if we forget to bump the version, the OLD
// cached HTML/JS continues to be served alongside the new server
// HTML and React's reconciler throws a server components error.
//
// The build pipeline (see scripts/sync-sw-cache-version.sh) keeps
// the CACHE_VERSION below in sync with the Vercel deployment id
// so we never ship a new build without invalidating the cache.
//
// Strategy:
//   - App shell (HTML, JS, CSS) → network-first, cache fallback
//   - API routes (Prisma) → network-only (never cache)
//   - RSC payloads → network-only (never cache — they're per-request)
//   - Static assets (icons, images) → cache-first
//
// Form drafts are persisted in localStorage by the app itself, not here.

const CACHE_VERSION = 'udgok-v4-d5e5c9c-2026-08-26';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/workspaces',
  '/sign-in',
  '/sign-up',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {})),
  );
  // Force the new SW to take over immediately, don't wait for
  // existing tabs to close. This is the key to invalidating
  // stale bundles — without skipWaiting, users keep running
  // the old SW (and its old cached responses) until they
  // close every tab.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Wipe ALL caches from previous versions. The old RUNTIME
      // cache might still hold HTML from a previous deploy whose
      // JS bundle hashes no longer exist on the server; if we
      // serve that, React's reconciler throws because the new
      // HTML references a different component tree.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      // Also clear THIS version's runtime cache on activation,
      // because any HTML in there references JS bundles that
      // are about to be swapped out by the new deploy. Re-cache
      // happens naturally on the next navigation.
      const runtime = await caches.open(RUNTIME_CACHE);
      const runtimeKeys = await runtime.keys();
      await Promise.all(runtimeKeys.map((k) => runtime.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API routes — network only, never cache. The data is
  // per-workspace, per-user, and per-second. Caching API
  // responses causes stale data to show up.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
    return;
  }

  // Next.js RSC payloads — network only, never cache. These
  // are per-request, depend on the user's session, and include
  // the current state of every server component. Caching them
  // returns stale data after any mutation.
  const accept = request.headers.get('accept') ?? '';
  const isRsc = request.headers.get('rsc') !== null || accept.includes('text/x-component');
  if (isRsc) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 504, statusText: 'Offline' })),
    );
    return;
  }

  // HTML pages — network only. Previously we did network-first
  // with cache fallback, but that meant a user coming back to
  // the site after a deploy would see the OLD cached HTML
  // (whose JS bundle hashes no longer exist on the server).
  // The safer trade-off: require a network connection for
  // HTML. The app shell (above) is still cached for offline
  // cold-start, so the "offline" experience launches the
  // marketing/sign-in pages without HTML access.
  const isHtml = accept.includes('text/html');
  if (isHtml) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/').then((r) => r || new Response(
        '<!doctype html><html><body><h1>Offline</h1><p>Reconnect to view the app.</p></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html' } },
      ))),
    );
    return;
  }

  // Static assets (Next.js _next/static/*, icons, images) —
  // cache first. The filenames include content hashes so a
  // new deploy produces new URLs and the old cache is harmless.
  // Fall back to a 504 response if the network is down or the
  // request is aborted (e.g. user navigated away mid-fetch).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    }),
  );
});
