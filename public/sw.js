// UDGOK CMS service worker — enables PWA install + offline app shell.
// Strategy:
//   - App shell (HTML, JS, CSS) → cache-first, revalidate in background
//   - API routes (Prisma) → network-first, fall back to cache
//   - Static assets (icons, images) → cache-first
//
// This caches enough to launch the app and read cached data when offline.
// Form drafts are persisted in localStorage by the app itself, not here.

const CACHE_VERSION = 'udgok-v3';
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
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API routes — network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || new Response('{"offline": true}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }))),
    );
    return;
  }

  // Next.js pages — network first, fall back to cached shell
  // Also catches RSC (React Server Component) payloads: Next.js's
  // router.refresh() sends a fetch with `RSC: 1` and
  // `accept: text/x-component`, NOT text/html. If we let those
  // fall through to the static-assets branch below, the SW
  // serves a stale RSC payload from before the user's last
  // mutation (e.g. upload) and the new data never renders.
  // Treating RSC like HTML (network-first) fixes that.
  const accept = request.headers.get('accept') ?? '';
  const isHtml = accept.includes('text/html');
  const isRsc = request.headers.get('rsc') !== null || accept.includes('text/x-component');
  if (isHtml || isRsc) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Don't cache RSC payloads — they're per-request,
          // and caching them across requests returns stale data.
          if (isHtml) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          isHtml
            ? caches.match(request).then((r) => r || caches.match('/'))
            : new Response('', { status: 504, statusText: 'Offline' }),
        ),
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
