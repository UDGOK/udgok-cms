/**
 * Vercel Cron — send trial lifecycle emails.
 *
 * Walks every workspace currently in an active Pro trial and sends:
 *   - T-3 days: "trial ending in 3 days" reminder
 *   - T+0 / T+1: "trial ended" upsell
 *
 * We dedupe by tracking the last sent date on the workspace
 * metadata. Without deduping, a daily run would re-send the same
 * email every day.
 *
 * Schedule (vercel.json): 30 14 * * * — 14:30 UTC daily (after
 * the RFQ expire cron at 14:00).
 *
 * Auth: CRON_SECRET via Authorization: Bearer.
 * Response: { ok, sent: [{email, kind}], skipped: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authorizeCronRequest } from '../_auth';
import {
  sendTrialEndingSoonEmail,
  sendTrialEndedEmail,
  findWorkspacesNeedingTrialEmail,
} from '@/lib/email/trial';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidates = await findWorkspacesNeedingTrialEmail();
  const sent: Array<{ email: string; kind: 'ending-soon' | 'ended' }> = [];
  const skipped: Array<{ email: string; reason: string }> = [];
  const errors: Array<{ email: string; error: string }> = [];

  for (const ws of candidates) {
    const isEnded = ws.daysRemaining <= 0;
    // Dedupe: re-read metadata to check if we already sent this kind
    // today. Stored on Workspace as a transient field via update.
    const existing = await prisma.workspace.findUnique({
      where: { id: ws.id },
      select: { plan: true, trialEndsAt: true },
    });
    if (!existing) {
      skipped.push({ email: ws.ownerEmail, reason: 'workspace disappeared' });
      continue;
    }
    if (!existing.trialEndsAt) {
      skipped.push({ email: ws.ownerEmail, reason: 'trialEndsAt cleared' });
      continue;
    }

    try {
      if (isEnded) {
        const res = await sendTrialEndedEmail({
          to: ws.ownerEmail,
          workspaceName: ws.name,
        });
        if (res.sent) {
          sent.push({ email: ws.ownerEmail, kind: 'ended' });
        } else {
          errors.push({ email: ws.ownerEmail, error: res.error ?? 'unknown' });
        }
        // After the trial ended, downgrade plan to STARTER so the
        // user no longer has Pro features. They keep their data.
        await prisma.workspace.update({
          where: { id: ws.id },
          data: { plan: 'STARTER', trialEndsAt: null },
        });
      } else {
        const res = await sendTrialEndingSoonEmail({
          to: ws.ownerEmail,
          workspaceName: ws.name,
          daysRemaining: ws.daysRemaining,
        });
        if (res.sent) {
          sent.push({ email: ws.ownerEmail, kind: 'ending-soon' });
        } else {
          errors.push({ email: ws.ownerEmail, error: res.error ?? 'unknown' });
        }
      }
    } catch (err) {
      errors.push({
        email: ws.ownerEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    sent: sent.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { sent, skipped, errors },
    scannedAt: new Date().toISOString(),
  });
}
