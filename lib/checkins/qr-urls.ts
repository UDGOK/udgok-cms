/**
 * Pure URL builders for site check-in. Safe for both server
 * AND client — no node:crypto, no env imports. Used by the
 * printable sheet (a client component) to render QR codes
 * via the public api.qrserver.com encoder.
 *
 * Token generation lives in `qr-token.ts` (server-only).
 */

import { env } from '@/lib/env';

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
