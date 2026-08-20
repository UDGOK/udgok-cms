import { randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * QR code generation helpers for site check-in.
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
 */

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

/**
 * Build the public URL that the QR encodes. The URL is
 * what an employee or sub foreman opens when they scan.
 *
 * `env.APP_URL` is whatever's set in NEXT_PUBLIC_APP_URL
 * (defaults to http://localhost:3000 in dev). The URL has
 * no trailing slash, and the path is `/c/<token>` — kept
 * short so the QR is low-density and decodes fast on a
 * phone camera in low light.
 */
export function buildCheckInUrl(token: string, baseUrl?: string): string {
  const base = (baseUrl ?? env.APP_URL).replace(/\/+$/, '');
  return `${base}/c/${token}`;
}

/**
 * Build the URL the browser hits to load the QR image.
 * We use api.qrserver.com (a free, no-API-key QR encoder)
 * because we don't need a real-time encoder library in
 * the build — the URL is just an <img src>.
 *
 * The data parameter is the public check-in URL.
 * 300x300 is large enough to be clearly scannable from
 * a few feet away when printed, and small enough that
 * the API responds in <100ms.
 */
export function buildQrImageUrl(checkInUrl: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(checkInUrl)}`;
}
