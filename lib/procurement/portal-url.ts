/**
 * Build the public vendor portal URL for a PO.
 *
 *   https://cms.udgok.com/p/<token>
 *
 * The token here is the PLAINTEXT (not hashed) — it's
 * safe to put in an email because the DB only stores
 * the hash. If NEXT_PUBLIC_APP_URL is unset, falls back
 * to cms.udgok.com.
 */

export function resolvePoPortalUrl(plaintextToken: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://cms.udgok.com';
  return `${base}/p/${plaintextToken}`;
}
