/**
 * Vercel Cron — nightly Neon backup.
 *
 * Schedule (vercel.json): 0 6 * * * (06:00 UTC daily).
 *
 * Each run:
 *   1. Creates a new branch on Neon named nightly-YYYY-MM-DD
 *      (point-in-time, current state at the moment of the call).
 *   2. Prunes backup branches older than 14 days to stay under
 *      the 5000-branch quota.
 *
 * Auth: CRON_SECRET via Authorization: Bearer.
 * Response: { created: string, deleted: string[], kept: number }
 *
 * We don't write to ActivityLog for this — backups are an
 * infrastructure concern, not a workspace event. The Vercel
 * function log captures the response JSON for audit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest } from '../_auth';
import { createBackupBranch, pruneOldBackups } from '@/lib/backup/neon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Create the nightly snapshot
  const snapshot = await createBackupBranch('nightly');

  // 2. Prune old branches. Best-effort — if pruning fails the new
  //    snapshot is still safe.
  const { deleted, kept } = await pruneOldBackups({ keepDays: 14 });

  return NextResponse.json({
    ok: true,
    created: snapshot.branchName,
    branchId: snapshot.branchId,
    expiresAt: snapshot.expiresAt,
    pruned: deleted,
    kept,
  });
}
