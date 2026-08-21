/**
 * Vendor portal token generator for issued POs.
 *
 * Mirrors the RFQ token pattern (lib/procurement/token.ts):
 * 32 random bytes → 256 bits of entropy → base64url.
 * Returns BOTH the plaintext (goes in the email) and the
 * SHA-256 hash (goes in the DB). The plaintext is never
 * stored on disk.
 */

import { createHash, randomBytes } from 'node:crypto';

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateVendorPortalToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString('base64url');
  return { plaintext, hash: hash(plaintext) };
}

// Re-exported for the resend path which needs to re-hash
// a freshly-minted plaintext without importing from token.ts.
export const sha256Token = hash;
