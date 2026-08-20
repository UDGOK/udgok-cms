/**
 * Vercel Cron — expire stale RFQs.
 *
 * Per spec §12: "SENT/VIEWED past expiresAt → EXPIRED".
 * Runs daily. Flips the status on every RFQ whose expiresAt
 * has passed and that isn't already in a terminal state.
 *
 * Schedule (vercel.json): 0 14 * * * — 14:00 UTC daily.
 *
 * Auth: CRON_SECRET via Authorization: Bearer.
 * Response: { expired: number, scanned: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authorizeCronRequest } from '../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find all RFQs that are SENT or VIEWED with an expiresAt
  // in the past. UpdateMany is one statement; we capture the
  // count before + after to report the number flipped.
  const before = await prisma.rfq.count({
    where: {
      status: { in: ['SENT', 'VIEWED'] },
      expiresAt: { lt: now },
    },
  });

  if (before > 0) {
    await prisma.rfq.updateMany({
      where: {
        status: { in: ['SENT', 'VIEWED'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });
  }

  return NextResponse.json({ ok: true, expired: before, scannedAt: now.toISOString() });
}
