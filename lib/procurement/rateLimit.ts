/**
 * Postgres-backed rate limiter for the vendor portal.
 *
 * Spec §7.5: "no Redis in the stack today, so use Postgres.
 * It's fine at this volume." We piggy-back on Prisma's
 * $queryRaw to keep the SQL readable; a single atomic
 * UPSERT/RETURNING is the entire mechanism. The key
 * includes a token prefix + IP so per-token or per-IP
 * floods are both handled.
 *
 * Usage:
 *   const limited = await rateLimit(`rfq:view:${prefix}:${ip}`, { max: 60, windowSec: 600 });
 *   if (!limited.ok) return new Response('Too many requests', { status: 429 });
 */

import { prisma } from '@/lib/db/client';

export type RateLimitResult = { ok: true; count: number } | { ok: false; count: number };

export async function rateLimit(
  key: string,
  opts: { max: number; windowSec: number },
): Promise<RateLimitResult> {
  // Bound the key length so a malicious caller can't make it
  // unboundedly long.
  if (key.length > 200) key = key.slice(0, 200);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${opts.windowSec})
        THEN 1 ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${opts.windowSec})
        THEN now() ELSE "RateLimit"."windowStart"
      END
    RETURNING "count";
  `;
  const count = rows[0]?.count ?? 1;
  return count <= opts.max ? { ok: true, count } : { ok: false, count };
}
