/**
 * Typed env access. Throws at startup if required vars are missing.
 * Use this instead of `process.env.X` directly so we get autocomplete + a single
 * place to validate the runtime environment.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  // Database
  DATABASE_URL: required('DATABASE_URL'),

  // Clerk
  CLERK_PUBLISHABLE_KEY: required('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
  CLERK_SECRET_KEY: required('CLERK_SECRET_KEY'),
  CLERK_WEBHOOK_SECRET: optional('CLERK_WEBHOOK_SECRET'),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: optional('BLOB_READ_WRITE_TOKEN'),

  // AI providers
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY'),
  OPENAI_API_KEY: optional('OPENAI_API_KEY'),

  // Resend
  RESEND_API_KEY: optional('RESEND_API_KEY'),
  RESEND_FROM_ADDRESS: optional('RESEND_FROM_ADDRESS') ?? 'noreply@udgok.app',

  // App
  APP_URL: optional('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',
} as const;
