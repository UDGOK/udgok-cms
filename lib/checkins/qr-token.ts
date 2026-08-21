/**
 * Server-only token generation for site check-in.
 *
 * The token IS the credential. Anyone with the sticker can
 * scan it; the system trusts the on-site phone to attribute
 * the scan. We don't put the project id in the URL because
 * that would let anyone with one sticker iterate project
 * ids and learn the workspace's other projects.
 *
 * 24 bytes (192 bits) of entropy → 48 hex characters. That's
 * 3.2 × 10^57 possible values; brute-forcing the URL is
 * computationally infeasible. Even at 1B guesses per second
 * the expected time-to-hit is 10^41 years.
 *
 * Split from qr.ts so the printable sheet (a client
 * component) can import the URL builders without dragging
 * in node:crypto — which would crash the client bundle.
 */

import { randomBytes } from 'node:crypto';

/** Length of the random token, in bytes. */
export const QR_TOKEN_BYTES = 24;

/**
 * Generate a fresh, URL-safe random token for a new
 * check-in code. Returns a 48-character lowercase hex
 * string (24 bytes).
 */
export function generateCheckInToken(): string {
  return randomBytes(QR_TOKEN_BYTES).toString('hex');
}
