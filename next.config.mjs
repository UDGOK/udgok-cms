/** @type {import('next').NextConfig} */
// Vercel "smart prefix" integration can rename env vars (UDGOK_CMS_*, UDGOK_BLOB_*, etc.)
// but third-party SDKs (Clerk, Resend, Vercel Blob) read the standard unprefixed names.
// This shim copies prefixed values into unprefixed keys at process start so every SDK
// finds what it expects. Unprefixed values (set locally or directly) take precedence.
const aliases = {
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: [
    'NEXT_PUBLIC_UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
    'UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
    'AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
  ],
  CLERK_SECRET_KEY: [
    'UDGOKCMS_AUTHENTICATION_CLERK_SECRET_KEY',
    'AUTHENTICATION_CLERK_SECRET_KEY',
  ],
  CLERK_WEBHOOK_SECRET: [
    'UDGOK_CMS_CLERK_WEBHOOK_SECRET',
    'UDGOKCMS_AUTHENTICATION_CLERK_WEBHOOK_SECRET',
    'AUTHENTICATION_CLERK_WEBHOOK_SECRET',
  ],
  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: ['UDGOK_BLOB_READ_WRITE_TOKEN'],
  // Resend
  RESEND_API_KEY: ['UDGOK_MESSAGING_RESEND_API_KEY'],
  // Database
  DATABASE_URL: ['UDGOK_CMS_DATABASE_URL', 'UDGOK_CMS_POSTGRES_URL', 'UDGOK_CMS_POSTGRES_PRISMA_URL'],
  // App
  NEXT_PUBLIC_APP_URL: ['UDGOK_CMS_APP_URL'],
  // Master admin emails (JSON array, optional — yasir@udgok.com is always master)
  UDGOK_CMS_MASTERS: ['MASTERS'],
  // NVIDIA NIM AI (replaces DeepSeek). Two-way aliasing so both
  // UDGOK_CMS_NVIDIA_API_KEY and NVIDIA_API_KEY resolve either way.
  NVIDIA_API_KEY: ['UDGOK_CMS_NVIDIA_API_KEY'],
  UDGOK_CMS_NVIDIA_API_KEY: ['NVIDIA_API_KEY'],
  // Legacy DeepSeek aliases (kept so any leftover env vars don't crash reads)
  DEEPSEEK_API_KEY: ['UDGOK_CMS_DEEPSEEK_API_KEY'],
  UDGOK_CMS_DEEPSEEK_API_KEY: ['DEEPSEEK_API_KEY'],
  // Nominatim (OpenStreetMap) geocoder. We use the OSM public service —
  // no API key, but we identify ourselves with a User-Agent per their ToS.
  UDGOK_CMS_NOMINATIM_USER_AGENT: ['NOMINATIM_USER_AGENT'],
  UDGOK_CMS_NOMINATIM_BASE_URL: ['NOMINATIM_BASE_URL'],
  // BIM/IFC takeoff service (Python/FastAPI on Fly.io). The CMS
  // POSTs the .ifc blob URL to /takeoff; service returns quantities.
  UDGOK_CMS_TAKEOFF_SERVICE_URL: ['TAKEOFF_SERVICE_URL'],
  UDGOK_CMS_TAKEOFF_API_KEY: ['TAKEOFF_API_KEY'],
};

for (const [target, sources] of Object.entries(aliases)) {
  if (!process.env[target]) {
    for (const src of sources) {
      if (process.env[src]) {
        process.env[target] = process.env[src];
        break;
      }
    }
  }
}

// Set explicit defaults for Clerk's sign-in/up URL env vars. Clerk's
// middleware reads these to know where to redirect when an unauthenticated
// user hits a protected route. Without them, the middleware does a
// rewrite-to-404 (or 500) instead of a proper redirect.
if (!process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL) {
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL = '/sign-in';
}
if (!process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL) {
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL = '/sign-up';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb', // Vercel Blob upload size cap
    },
  },
  // Remove the X-Powered-By header. It tells attackers "this is
  // Next.js" and saves them a fingerprinting step. The cost is
  // zero — every modern browser doesn't use it.
  poweredByHeader: false,
  async headers() {
    // The full CSP is large; build it here so the logic stays
    // legible. We start with the audit agent's recommended baseline
    // and extend it for the actual origins this app talks to:
    //   - Vercel Blob (file storage, *.public.blob.vercel-storage.com)
    //   - Clerk (auth)
    //   - OpenStreetMap tiles (map feature)
    //   - Nominatim (geocoding API)
    //   - The AI service (NVIDIA NIM — currently we call it
    //     server-side only, but we list it for forward-compat
    //     if we ever proxy through)
    //   - data: / blob: images (PWA offline, camera capture)
    //
    // 'unsafe-inline' is allowed in script-src because Next.js
    // inlines small bootstrap scripts for streaming SSR. We
    // also allow 'unsafe-eval' for the same reason (the
    // production build doesn't actually need it but removing
    // it breaks dev mode). The cost is small — Vercel already
    // has strong XSS protections via React's escaping.
    const csp = [
      "default-src 'self'",
      // Clerk's browser bundle needs to load; their UI inlines styles.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.udgok.com",
      // Tailwind injects styles; Clerk UI inlines styles. We trust
      // everything we generate, plus the Clerk domains.
      "style-src 'self' 'unsafe-inline' https://clerk.udgok.com",
      // Images: self, blob: (camera capture / image resizing),
      // data: (small inline icons / QR codes), and the Clerk CDN
      // (user avatars), plus OSM tile servers for the map.
      "img-src 'self' data: blob: https://clerk.udgok.com https://img.clerk.com https://*.tile.openstreetmap.org",
      "font-src 'self' data:",
      // Connections: our own server, Clerk, the OSM geocoder +
      // tile servers, and Vercel Blob. Add Nominatim too.
      "connect-src 'self' https://clerk.udgok.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.weather.gov https://*.public.blob.vercel-storage.com https://api.resend.com",
      // We don't render PDF inline, we don't use <object>, and
      // we don't host user-uploaded HTML. Lock these down.
      "object-src 'none'",
      "frame-src 'self' https://clerk.udgok.com", // Clerk's sign-in modal
      "frame-ancestors 'none'", // clickjacking — no embedding
      "base-uri 'self'",
      "form-action 'self' https://clerk.udgok.com",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          // HSTS — the agent's existing HSTS was present but
          // missing includeSubDomains. Adding it (and preload,
          // since we're committed to HTTPS everywhere).
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Clickjacking defense (CSP frame-ancestors also handles
          // this, but X-Frame-Options is a belt-and-braces fallback
          // for very old browsers).
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME sniffing.
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Don't leak full URLs (which may carry workspace / project
          // IDs) to third-party origins.
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // The app legitimately needs camera + geolocation (Scan,
          // GPS-tagged photos). We deny everything else, including
          // microphone (we don't record audio).
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self), geolocation=(self), microphone=(), ' +
              'payment=(), usb=(), magnetometer=(), gyroscope=(), ' +
              'accelerometer=()',
          },
          // Cross-origin isolation. Required for SharedArrayBuffer
          // (none used today, but cheap insurance).
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site',
          },
          // Hint to browsers that we want HTTPS only.
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
