/**
 * Vercel Cron — rate-limit GC.
 *
 * Cleans up RateLimit rows that are older than the rolling
 * window. Keeps the table small so SELECTs stay fast as
 * vendor portal traffic grows.
 *
 * Schedule (vercel.json): 0 3 * * * — 03:00 UTC daily.
 *
 * Auth: CRON_SECRET via Authorization: Bearer.
 * Response: { deleted: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authorizeCronRequest } from '../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WINDOW_DAYS = 7; // keep 7 days of rate-limit history

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });

  return NextResponse.json({ ok: true, deleted: count, cutoff: cutoff.toISOString() });
}
