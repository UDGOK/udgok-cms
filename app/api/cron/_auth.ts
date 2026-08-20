/**
 * Vercel Cron auth helper.
 *
 * Per spec §9.1: "Cron jobs are protected with CRON_SECRET —
 * Vercel sends it as Authorization: Bearer. Reject anything else."
 *
 * We also defense-in-depth:
 *   - Compare with constant-time `timingSafeEqual` to avoid
 *     timing oracles (the secret is long, but cheap to do right)
 *   - Reject any request that doesn't carry the header at all
 *
 * Used by every /api/cron/* route. Returning 401 + a static
 * message keeps the surface small.
 */

import { timingSafeEqual } from 'node:crypto';

export function authorizeCronRequest(authHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed: if no CRON_SECRET is set, refuse all
    // cron calls rather than silently letting them through.
    console.error('[cron] CRON_SECRET is not set — refusing request');
    return false;
  }
  if (!authHeader) return false;
  if (!authHeader.startsWith('Bearer ')) return false;
  const presented = authHeader.slice('Bearer '.length).trim();
  if (presented.length !== expected.length) return false;

  // constant-time compare
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return timingSafeEqual(a, b);
}
