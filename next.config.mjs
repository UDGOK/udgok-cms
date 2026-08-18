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
};

export default nextConfig;
