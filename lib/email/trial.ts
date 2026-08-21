/**
 * Trial emails — sent to the workspace owner when their Pro trial
 * is about to end (T-3 days) and the day it ends.
 *
 * Uses Resend with a plain HTML template. Respects the existing
 * env shim pattern (RESEND_API_KEY / RESEND_FROM_ADDRESS).
 */

import { env } from '@/lib/env';
import { prisma } from '@/lib/db/client';

const FROM = () => env.RESEND_FROM_ADDRESS || 'noreply@udgok.app';

interface TrialEmail {
  to: string;
  workspaceName: string;
  daysRemaining: number;
}

/**
 * Send the "trial ending in 3 days" reminder.
 */
export async function sendTrialEndingSoonEmail({
  to,
  workspaceName,
  daysRemaining,
}: TrialEmail): Promise<{ sent: boolean; error?: string }> {
  const subject = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your UDGOK Pro trial`;
  const html = trialEndingHtml({ workspaceName, daysRemaining });
  const text = trialEndingText({ workspaceName, daysRemaining });
  return send({ to, subject, html, text });
}

/**
 * Send the "trial ended" email — upsell to Pro.
 */
export async function sendTrialEndedEmail({
  to,
  workspaceName,
}: Omit<TrialEmail, 'daysRemaining'>): Promise<{ sent: boolean; error?: string }> {
  const subject = `Your UDGOK Pro trial ended — here's what's next`;
  const html = trialEndedHtml({ workspaceName });
  const text = trialEndedText({ workspaceName });
  return send({ to, subject, html, text });
}

async function send({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, error: 'RESEND_API_KEY not set' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM(),
        to,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function trialEndingHtml({ workspaceName, daysRemaining }: { workspaceName: string; daysRemaining: number }) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a1a">
      <div style="background:#ff6b1f;color:#fff;padding:10px 14px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;font-size:12px;display:inline-block">
        Pro trial · ending soon
      </div>
      <h2 style="font-size:22px;margin:14px 0 6px">${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left, ${workspaceName}.</h2>
      <p style="color:#555;margin:0 0 14px">
        Your UDGOK Pro trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.
        After that, your workspace drops to the free Starter plan and
        GPS photos, barcode scanning, and export will be paused.
      </p>
      <p style="color:#555;margin:0 0 14px">
        <b>Pro keeps the field tools your crew is using right now.</b>
      </p>
      <a href="https://cms.udgok.com/w/${encodeURIComponent(workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/settings/billing"
         style="display:inline-block;background:#ff6b1f;color:#fff;padding:12px 18px;font-weight:800;text-decoration:none;font-size:12px;letter-spacing:.12em;text-transform:uppercase">
        Upgrade to Pro →
      </a>
      <p style="color:#888;font-size:11px;margin-top:20px">
        Questions? Reply to this email — Yasir reads every one.
      </p>
    </div>
  `;
}

function trialEndingText({ workspaceName, daysRemaining }: { workspaceName: string; daysRemaining: number }) {
  return [
    `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left, ${workspaceName}.`,
    ``,
    `Your UDGOK Pro trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
    `After that, your workspace drops to the free Starter plan and GPS photos,`,
    `barcode scanning, and export will be paused.`,
    ``,
    `Pro keeps the field tools your crew is using right now.`,
    ``,
    `Upgrade: https://cms.udgok.com/w/${encodeURIComponent(workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/settings/billing`,
    ``,
    `Questions? Reply to this email.`,
  ].join('\n');
}

function trialEndedHtml({ workspaceName }: { workspaceName: string }) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a1a">
      <div style="background:#1a1a1a;color:#fff;padding:10px 14px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;font-size:12px;display:inline-block">
        Trial ended
      </div>
      <h2 style="font-size:22px;margin:14px 0 6px">Your Pro trial ended today, ${workspaceName}.</h2>
      <p style="color:#555;margin:0 0 14px">
        Your workspace is now on the free Starter plan. GPS photos,
        barcode scanning, and export are paused — your data is all
        still there, just the Pro features are off.
      </p>
      <p style="color:#555;margin:0 0 14px">
        Want them back? Upgrade to Pro in two clicks.
      </p>
      <a href="https://cms.udgok.com/w/${encodeURIComponent(workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/settings/billing"
         style="display:inline-block;background:#ff6b1f;color:#fff;padding:12px 18px;font-weight:800;text-decoration:none;font-size:12px;letter-spacing:.12em;text-transform:uppercase">
        Upgrade to Pro →
      </a>
    </div>
  `;
}

function trialEndedText({ workspaceName }: { workspaceName: string }) {
  return [
    `Your Pro trial ended today, ${workspaceName}.`,
    ``,
    `Your workspace is now on the free Starter plan. GPS photos,`,
    `barcode scanning, and export are paused. Your data is still there.`,
    ``,
    `Upgrade: https://cms.udgok.com/w/${encodeURIComponent(workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/settings/billing`,
  ].join('\n');
}

/**
 * Look up all workspaces currently in a paid Pro trial that need an
 * email sent today. The cron job calls this and dedupes by checking
 * if a recent trial email has already been sent.
 */
export async function findWorkspacesNeedingTrialEmail(): Promise<
  Array<{ id: string; name: string; ownerEmail: string; trialEndsAt: Date; daysRemaining: number }>
> {
  const now = new Date();
  const inFourDays = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  // Find workspaces with trialEndsAt in the windows we care about.
  // We send:
  //   - T-3 days (window: 2-4 days out)
  //   - T+0 / T+1 (window: 0-1 day past)
  const workspaces = await prisma.workspace.findMany({
    where: {
      plan: 'PRO',
      trialEndsAt: { not: null },
    },
    include: {
      members: {
        where: { role: 'OWNER' },
        include: { user: { select: { email: true } } },
        take: 1,
      },
    },
  });

  const out: Array<{ id: string; name: string; ownerEmail: string; trialEndsAt: Date; daysRemaining: number }> = [];
  for (const ws of workspaces) {
    if (!ws.trialEndsAt) continue;
    const t = new Date(ws.trialEndsAt);
    const days = Math.ceil((t.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    // T-3 window
    if (t.getTime() > now.getTime() && t.getTime() <= inFourDays.getTime() && t.getTime() > inTwoDays.getTime()) {
      const owner = ws.members[0]?.user?.email;
      if (owner) out.push({ id: ws.id, name: ws.name, ownerEmail: owner, trialEndsAt: t, daysRemaining: days });
    }
    // T+0 / T+1 (trial just ended)
    if (t.getTime() <= now.getTime() && t.getTime() > yesterday.getTime()) {
      const owner = ws.members[0]?.user?.email;
      if (owner) out.push({ id: ws.id, name: ws.name, ownerEmail: owner, trialEndsAt: t, daysRemaining: 0 });
    }
  }
  return out;
}
