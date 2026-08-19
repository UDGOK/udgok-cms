/**
 * Schema-drift diagnostic for master admins. Surfaces the
 * "schema updated locally, DB not pushed" failure mode before
 * it crashes a real user request.
 *
 * Hit: GET /api/admin/diag-schema
 *
 * Returns:
 *   { inSync: true,  drift: [] }                 — all good
 *   { inSync: false, drift: ['PayApp.acknowledgedByEmail', ...] }
 *
 * The list of probed columns is the set of "added in a
 * schema change" columns that have caused (or could cause)
 * the worst runtime breakage. Add to it whenever you add
 * a new column that's part of an `include:` in a hot query.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';

/**
 * Columns that are part of `include:` paths in hot queries.
 * If any of these is missing from the DB, the corresponding
 * query throws a Prisma error. Probe them via information_schema
 * so the diagnostic never depends on the missing column being
 * queryable through Prisma.
 */
const PROBES: { table: string; column: string }[] = [
  { table: 'PayApp', column: 'acknowledgedByEmail' },
  { table: 'PayApp', column: 'acknowledgedByName' },
  { table: 'Project', column: 'contractValue' },
  { table: 'Project', column: 'latitude' },
  { table: 'Project', column: 'longitude' },
];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!(await isMasterAdmin(userId))) {
    return NextResponse.json({ error: 'Master admin required' }, { status: 403 });
  }

  const drift: string[] = [];
  for (const { table, column } of PROBES) {
    try {
      const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${table}
            AND column_name = ${column}
        ) AS exists
      `;
      if (!rows[0]?.exists) drift.push(`${table}.${column}`);
    } catch (err) {
      drift.push(
        `${table}.${column} (probe error: ${err instanceof Error ? err.message : 'unknown'})`,
      );
    }
  }

  return NextResponse.json({ inSync: drift.length === 0, drift });
}
