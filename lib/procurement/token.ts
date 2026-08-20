/**
 * Magic-link token utilities for the vendor portal.
 *
 * Per spec §6:
 *   - 32 bytes = 256 bits of entropy, base64url = 43 chars.
 *   - Plaintext token goes in the email ONLY. Database
 *     stores the SHA-256 hash so a DB leak doesn't
 *     expose active links.
 *   - constant-time compare on lookup to avoid timing oracles.
 *
 * Phase 2 (RFQ loop) wires these into sendRfq + the public
 * portal's submit handler.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** 32 bytes = 256 bits, base64url-encoded. Not guessable. */
export function generateRfqToken() {
  const raw = randomBytes(32).toString('base64url');
  return {
    token: raw,
    tokenHash: sha256(raw),
    tokenPrefix: raw.slice(0, 8),
  };
}

/** Constant-time equality check on hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Hashed IP for the audit log. Never store raw IPs (GDPR).
 *  Salt comes from APP_HASH_SALT env var; rotating the salt
 *  invalidates old hashes (intentional — stops correlation
 *  across salt windows). */
export function hashIp(ip: string | null, salt: string): string | null {
  if (!ip) return null;
  return sha256(`${salt}:${ip}`);
}
