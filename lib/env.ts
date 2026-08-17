/**
 * Typed env access. Throws at startup if required vars are missing.
 * Use this instead of `process.env.X` directly so we get autocomplete + a single
 * place to validate the runtime environment.
 *
 * Vercel "smart prefix" naming is enabled for this project, so all manually-set
 * vars come through as `UDGOK_CMS_*`, `UDGOK_BLOB_*`, etc. We accept BOTH the
 * prefixed and the unprefixed names so the same code works in:
 *   - Vercel production (prefixed via integration)
 *   - Local .env (unprefixed, conventional)
 * The unprefixed name takes precedence locally; the prefixed name takes precedence
 * in Vercel since that's where it's set.
 */

const read = (...names: string[]): string | undefined => {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.length > 0) return v;
  }
  return undefined;
};

const required = (...names: string[]): string => {
  const v = read(...names);
  if (!v) {
    throw new Error(`Missing required env var. Tried: ${names.join(', ')}`);
  }
  return v;
};

const optional = (...names: string[]): string | undefined => read(...names);

// Helper: build full from-address from a domain if the full address isn't set.
// Accepts either `noreply@udgok.app` directly, OR a bare domain like `udgok.app`,
// OR the Vercel-prefixed variants.
const fromAddress = (): string => {
  const raw = optional(
    'RESEND_FROM_ADDRESS',
    'UDGOK_CMS_RESEND_FROM_ADDRESS',
    'UDGOK_MESSAGING_RESEND_FROM_ADDRESS',
  );
  if (raw && raw.includes('@')) return raw;
  const domain = optional(
    'RESEND_EMAIL_DOMAIN',
    'UDGOK_CMS_RESEND_EMAIL_DOMAIN',
    'UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN',
  );
  if (domain) {
    // Strip any leading scheme/protocol
    const clean = domain.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');
    return `noreply@${clean}`;
  }
  return 'noreply@udgok.app';
};

export const env = {
  // Database — Vercel integration gives us both UDGOK_CMS_POSTGRES_URL (pooled, for serverless)
  // and UDGOK_CMS_DATABASE_URL. We prefer the pooled one for Prisma + Neon.
  DATABASE_URL: required(
    'DATABASE_URL',
    'UDGOK_CMS_DATABASE_URL',
    'UDGOK_CMS_POSTGRES_URL',
  ),

  // Clerk — Vercel has multiple naming patterns depending on which integration
  // produced the env. We accept all of them.
  CLERK_PUBLISHABLE_KEY: required(
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
    'UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
    'AUTHENTICATION_CLERK_PUBLISHABLE_KEY',
  ),
  CLERK_SECRET_KEY: required(
    'CLERK_SECRET_KEY',
    'UDGOKCMS_AUTHENTICATION_CLERK_SECRET_KEY',
    'AUTHENTICATION_CLERK_SECRET_KEY',
  ),
  CLERK_WEBHOOK_SECRET: optional(
    'CLERK_WEBHOOK_SECRET',
    'UDGOK_CMS_CLERK_WEBHOOK_SECRET',
    'UDGOKCMS_AUTHENTICATION_CLERK_WEBHOOK_SECRET',
    'AUTHENTICATION_CLERK_WEBHOOK_SECRET',
  ),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: optional(
    'BLOB_READ_WRITE_TOKEN',
    'UDGOK_BLOB_READ_WRITE_TOKEN',
  ),

  // AI providers
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY', 'UDGOK_CMS_ANTHROPIC_API_KEY'),
  OPENAI_API_KEY: optional('OPENAI_API_KEY', 'UDGOK_CMS_OPENAI_API_KEY'),

  // Resend
  RESEND_API_KEY: optional('RESEND_API_KEY', 'UDGOK_MESSAGING_RESEND_API_KEY'),
  RESEND_FROM_ADDRESS: fromAddress(),

  // App — needed for the public pay app share link
  APP_URL: optional('NEXT_PUBLIC_APP_URL', 'UDGOK_CMS_APP_URL') ?? 'http://localhost:3000',
} as const;
