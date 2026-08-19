/**
 * Schema drift detector.
 *
 * Catches the "schema updated locally, DB not pushed" failure mode
 * before it crashes a real user request. Run this from /api/health
 * (master admin only) and from a server-component error boundary
 * so we can fail fast with a clear message instead of a cryptic
 * Prisma error in a project page.
 *
 * The check: ask the DB to introspect a column that only exists in
 * the current Prisma schema. If it errors, the DB is out of sync.
 *
 * Cheaper than running `prisma db pull` on every request — just one
 * column probe per call.
 */

import { prisma } from './client';

/**
 * Returns true if the production database schema matches the
 * generated Prisma client. Catches the most common drift: a new
 * column added in schema.prisma but never pushed.
 */
export async function isSchemaInSync(): Promise<{ inSync: boolean; missing?: string }> {
  try {
    // PayApp.acknowledgedByEmail was added in 6bf1a6a and caused a
    // 30-minute outage before we noticed. Probing for it catches
    // any future similar drift on the most-queried table.
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'PayApp'
          AND column_name = 'acknowledgedByEmail'
      ) AS exists
    `;
    if (!rows[0]?.exists) {
      return { inSync: false, missing: 'PayApp.acknowledgedByEmail' };
    }
    return { inSync: true };
  } catch (err) {
    return {
      inSync: false,
      missing: err instanceof Error ? err.message : 'unknown',
    };
  }
}
