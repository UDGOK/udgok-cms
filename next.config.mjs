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
  // Procurement / RFQ from-address. Tries (in order):
  //   1. UDGOK_MESSAGING_PROCUREMENT_FROM_EMAIL
  //   2. RESEND_FROM_ADDRESS (the standard Resend convention)
  //   3. lib/procurement/email.ts falls back to noreply@<RESEND_EMAIL_DOMAIN>
  //   4. lib/procurement/email.ts falls back to noreply@udgok.com
  PROCUREMENT_FROM_EMAIL: [
    'UDGOK_MESSAGING_PROCUREMENT_FROM_EMAIL',
    'RESEND_FROM_ADDRESS',
  ],
  // APP_HASH_SALT (for hashed IPs in RfqEvent) and CRON_SECRET
  // (Vercel cron bearer) — explicit, no aliases.
  APP_HASH_SALT: ['UDGOK_CMS_APP_HASH_SALT'],
  CRON_SECRET: ['UDGOK_CMS_CRON_SECRET'],
  // Database
  DATABASE_URL: ['UDGOK_CMS_DATABASE_URL', 'UDGOK_CMS_POSTGRES_URL', 'UDGOK_CMS_POSTGRES_PRISMA_URL'],
  // App
  NEXT_PUBLIC_APP_URL: ['UDGOK_CMS_APP_URL'],
  // Master admin emails (JSON array, optional — yasir@udgok.com is always master)
  UDGOK_CMS_MASTERS: ['MASTERS'],
  // OpenRouter AI gateway. Two-way aliasing so both
  // UDGOK_CMS_OPENROUTER_API_KEY and OPENROUTER_API_KEY
  // resolve either way. Set the env var on Vercel (or in
  // .env.local for dev) to enable AI features. No hardcoded
  // fallback — secrets in source get flagged by GitHub's
  // push-protection, so the key must be in env.
  OPENROUTER_API_KEY: ['UDGOK_CMS_OPENROUTER_API_KEY'],
  UDGOK_CMS_OPENROUTER_API_KEY: ['OPENROUTER_API_KEY'],
  // Legacy NVIDIA NIM / DeepSeek env vars (kept so any
  // leftover env vars on Vercel don't crash reads — code
  // no longer references them).
  NVIDIA_API_KEY: ['UDGOK_CMS_NVIDIA_API_KEY'],
  UDGOK_CMS_NVIDIA_API_KEY: ['NVIDIA_API_KEY'],
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

// IMPORTANT: For UDGOK_* env vars, PREFER the prefixed value over
// the unprefixed one when both are set. The project convention is
// that the prefixed value is the source of truth (Vercel "smart
// prefix" integration sets these). If we prefer unprefixed, a
// stale DATABASE_URL from an earlier deploy would shadow the
// current UDGOK_CMS_DATABASE_URL — which is what masked the Aug
// 2026 "Can't reach database server" error for hours.
//
// For non-UDGOK_* aliases (e.g. Clerk's NEXT_PUBLIC_CLERK_* which
// Vercel also renames), the existing "unprefixed wins" rule is
// fine because there's no project convention to honor.
for (const [target, sources] of Object.entries(aliases)) {
  const isUdgokPrefixed = target.startsWith('UDGOK_') || target.startsWith('UDGOK_CMS_') ||
    sources.some((s) => s.startsWith('UDGOK_') || s.startsWith('UDGOK_CMS_'));
  if (isUdgokPrefixed) {
    // Prefer the prefixed UDGOK_* source. Only fall back to
    // the unprefixed target if no prefixed source is set.
    let found = false;
    for (const src of sources) {
      if ((src.startsWith('UDGOK_') || src.startsWith('UDGOK_CMS_')) && process.env[src]) {
        process.env[target] = process.env[src];
        found = true;
        break;
      }
    }
    if (!found && !process.env[target]) {
      for (const src of sources) {
        if (process.env[src]) {
          process.env[target] = process.env[src];
          break;
        }
      }
    }
  } else if (!process.env[target]) {
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
    //   - The AI service (OpenRouter — server-side only, no
    //     CSP entry needed; the key is in env, never exposed
    //     to the browser)
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
      // (user avatars), OSM tile servers for the map, and Vercel
      // Blob storage for project photos / file uploads. Note
      // Vercel Blob URLs are subdomains of public.blob.vercel-
      // storage.com (e.g. 15c4iwiin1qbgxzg.public.blob.vercel-
      // storage.com) — the wildcard must be on the subdomain
      // part, not the host.
      //
      // `https://api.qrserver.com` is the free QR encoder used
      // by the check-in print sheet (lib/checkins/qr-urls.ts).
      // Without it the QR images silently 200 with a CSP-blocked
      // response and the printed/PDF'd sheet comes out blank —
      // an easy-to-miss bug because the HTML page itself
      // renders fine, the user only notices when they hit print.
      "img-src 'self' data: blob: https://clerk.udgok.com https://img.clerk.com https://*.tile.openstreetmap.org https://*.public.blob.vercel-storage.com https://public.blob.vercel-storage.com https://api.qrserver.com ",
      "font-src 'self' data:",
      // Connections: our own server, Clerk, the OSM geocoder +
      // tile servers, and Vercel Blob. Add Nominatim too.
      // `https://vercel.com` is required: the @vercel/blob v2.x
      // client PUTs the file to `vercel.com/api/blob/?pathname=...`
      // with auth headers, not directly to the public blob URL.
      // (Public read URLs are `*.public.blob.vercel-storage.com`,
      // which is a different host.)
      "connect-src 'self' https://clerk.udgok.com https://*.tile.openstreetmap.org https://*.public.blob.vercel-storage.com https://public.blob.vercel-storage.com https://nominatim.openstreetmap.org https://api.weather.gov https://vercel.com https://api.resend.com",
      // We don't render PDF inline, we don't use <object>, and
      // we don't host user-uploaded HTML. Lock these down.
      "object-src 'none'",
      "frame-src 'self' https://clerk.udgok.com", // Clerk's sign-in modal
      "frame-ancestors 'none'", // clickjacking — no embedding
      "base-uri 'self'",
      "form-action 'self' https://clerk.udgok.com",
      // PDF preview / image resizing use blob: workers.
      "worker-src 'self' blob:",
      // Inline-embedded workers for pdf.js etc.
      "child-src 'self' blob:",
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
      // Per spec §7.3: don't let the vendor portal be indexed
      // or cached. /q/[token] carries the credential; bots
      // must not see it, and CDNs must not serve a stale copy
      // to the next rep.
      {
        source: '/q/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private',
          },
        ],
      },
      {
        source: '/api/q/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
