/**
 * Admin-only manual backup endpoint.
 *
 * POST /api/admin/backup
 *   Creates an immediate point-in-time branch on Neon, named
 *   `manual-YYYYMMDD-HHMMSS-<shortid>`. Kept for 30 days
 *   (vs. 14 for nightly, since manual = operator chose it
 *   for a reason).
 *
 * GET /api/admin/backup
 *   Lists all backup branches (nightly + manual), newest first.
 *
 * Auth: master admin only. The yasir@udgok.com / yasir@futonix.com
 * / umair@udgok.com hardcoded admin check is in lib/admin/permissions.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isMasterAdmin } from '@/lib/admin/permissions';
import {
  createBackupBranch,
  listBackups,
  pruneOldBackups,
} from '@/lib/backup/neon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireMasterAdmin(): Promise<{ ok: true } | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!(await isMasterAdmin(userId))) {
    return NextResponse.json({ error: 'Master admin only' }, { status: 403 });
  }
  return { ok: true };
}

export async function GET() {
  const guard = await requireMasterAdmin();
  if (guard instanceof NextResponse) return guard;
  const branches = await listBackups();
  return NextResponse.json({ ok: true, branches });
}

export async function POST() {
  const guard = await requireMasterAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const result = await createBackupBranch('manual');
    return NextResponse.json({
      ok: true,
      branchId: result.branchId,
      branchName: result.branchName,
      expiresAt: result.expiresAt,
      // The pooled connection string is the rollback key —
      // pasting this into DATABASE_URL on Vercel will
      // point the app at this snapshot.
      rollbackConnectionString: result.pooledConnectionString,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const guard = await requireMasterAdmin();
  if (guard instanceof NextResponse) return guard;
  // Prune old branches on demand.
  const result = await pruneOldBackups({ keepDays: 14 });
  return NextResponse.json({ ok: true, ...result });
}
