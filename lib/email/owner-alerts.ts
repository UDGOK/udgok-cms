/**
 * Owner alert emails — internal notifications sent to the platform owner
 * (Yasir) when something interesting happens on the marketing side:
 *
 *   - new sign-up (Clerk webhook)
 *   - new lead (contact form, enterprise inquiry)
 *
 * These are NOT transactional user-facing emails. They go to the owner
 * inbox so they can follow up. Uses Resend with a "plain HTML" template
 * (no React Email — these are internal, keep them simple).
 *
 * Recipients: the master admin list. Defaults to the standard
 * yasir@udgok.com / yasir@futonix.com / umair@udgok.com set so the
 * alert still goes out even if MASTERS isn't configured.
 */

import { env } from '@/lib/env';
import { prisma } from '@/lib/db/client';

const DEFAULT_OWNER_EMAILS = [
  'yasir@udgok.com',
  'yasir@futonix.com',
  'umair@udgok.com',
];

/**
 * Resolve the owner email list. Uses the same master-admin list
 * pattern as the rest of the app, falling back to a default set so
 * the system never silently drops an alert.
 */
export async function getOwnerEmails(): Promise<string[]> {
  // 1. Try the MASTERS env shim (per project memory — "MASTERS" or
  //    "UDGOK_CMS_MASTERS" both work).
  const raw =
    process.env.UDGOK_CMS_MASTERS ||
    process.env.MASTERS ||
    process.env.OWNER_ALERT_EMAILS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((e) => typeof e === 'string')) {
        return parsed;
      }
    } catch {
      // fall through
    }
    // Comma-separated fallback
    const csv = raw.split(',').map((e) => e.trim()).filter(Boolean);
    if (csv.length > 0) return csv;
  }

  // 2. Try resolving the master admin emails from the DB. Each master
  //    admin is a Clerk user with a User row we can look up by email.
  try {
    const masters: string[] = [];
    for (const email of DEFAULT_OWNER_EMAILS) {
      if (await isMasterAdminByEmail(email)) masters.push(email);
    }
    if (masters.length > 0) return masters;
  } catch {
    // ignore
  }

  // 3. Last-resort default.
  return DEFAULT_OWNER_EMAILS;
}

async function isMasterAdminByEmail(email: string): Promise<boolean> {
  // We can't call isMasterAdmin without a userId, so we just trust the
  // default list. The /admin page restricts real master-admin auth.
  return DEFAULT_OWNER_EMAILS.includes(email.toLowerCase());
}

/**
 * Send an owner alert. Best-effort — never throws to the caller.
 * If Resend isn't configured or the send fails, we log a warning.
 */
async function sendOwnerAlert({
  subject,
  html,
  text,
}: {
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[owner-alert] RESEND_API_KEY not set; skipping alert', { subject });
    return { sent: false, error: 'RESEND_API_KEY not set' };
  }
  const to = await getOwnerEmails();
  if (to.length === 0) {
    return { sent: false, error: 'no owner emails' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_ADDRESS,
        to,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn('[owner-alert] Resend send failed', { status: res.status, body });
      return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    console.warn('[owner-alert] network error', err);
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Notify the owner when a new user signs up via Clerk.
 *
 * Inputs are best-effort — we may not have a workspace yet (they
 * haven't gone through /onboarding), so we just report the Clerk
 * user record and the request referer.
 */
export async function sendNewSignupAlert({
  email,
  name,
  clerkUserId,
  referer,
  utmSource,
  utmMedium,
  utmCampaign,
}: {
  email: string;
  name: string | null;
  clerkUserId: string;
  referer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): Promise<void> {
  // Look up the workspace if onboarding already happened
  let workspaceInfo: { slug: string; name: string } | null = null;
  try {
    const membership = await prisma.membership.findFirst({
      where: { userId: clerkUserId },
      orderBy: { joinedAt: 'asc' },
      include: { workspace: { select: { slug: true, name: true } } },
    });
    if (membership) workspaceInfo = membership.workspace;
  } catch {
    // ignore — owner alert still goes out
  }

  const subject = `🆕 New signup: ${email}${workspaceInfo ? ` → ${workspaceInfo.name}` : ''}`;
  const text = [
    `New UDGOK CMS signup`,
    ``,
    `Email: ${email}`,
    `Name:  ${name ?? '—'}`,
    `User:  ${clerkUserId}`,
    workspaceInfo ? `Workspace: ${workspaceInfo.name} (${workspaceInfo.slug})` : 'Workspace: not yet created (onboarding pending)',
    ``,
    `Source: ${utmSource ?? '—'} / ${utmMedium ?? '—'} / ${utmCampaign ?? '—'}`,
    `Referer: ${referer ?? '—'}`,
    ``,
    `Open the admin panel to follow up:`,
    `https://cms.udgok.com/admin/users`,
  ].join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a1a">
      <div style="background:#ff6b1f;color:#fff;padding:10px 14px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;font-size:12px;display:inline-block">
        New Signup
      </div>
      <h2 style="font-size:22px;margin:14px 0 6px">${email}</h2>
      <p style="color:#555;margin:0 0 14px">${name ?? '—'}</p>
      <table style="font-size:13px;border-collapse:collapse;width:100%;margin-bottom:14px">
        <tr><td style="color:#888;padding:4px 8px">User ID</td><td style="font-family:monospace;padding:4px 8px">${clerkUserId}</td></tr>
        <tr><td style="color:#888;padding:4px 8px">Workspace</td><td style="padding:4px 8px">${workspaceInfo ? `${workspaceInfo.name} <span style="color:#888">(${workspaceInfo.slug})</span>` : '<em style="color:#888">not yet created</em>'}</td></tr>
        <tr><td style="color:#888;padding:4px 8px">Source</td><td style="padding:4px 8px">${utmSource ?? '—'} / ${utmMedium ?? '—'} / ${utmCampaign ?? '—'}</td></tr>
        <tr><td style="color:#888;padding:4px 8px">Referer</td><td style="font-family:monospace;font-size:11px;padding:4px 8px">${referer ?? '—'}</td></tr>
      </table>
      <a href="https://cms.udgok.com/admin/users" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 16px;font-weight:700;text-decoration:none;font-size:12px;letter-spacing:.1em;text-transform:uppercase">
        Open admin →
      </a>
    </div>
  `;
  await sendOwnerAlert({ subject, html, text });
}

/**
 * Notify the owner when a new lead comes in from /contact or the
 * enterprise form. Includes a deep link to the lead detail.
 */
export async function sendNewLeadAlert({
  leadId,
  email,
  name,
  company,
  source,
  message,
  plan,
}: {
  leadId: string;
  email: string;
  name: string | null;
  company: string | null;
  source: string;
  message: string | null;
  plan: string | null;
}): Promise<void> {
  const subject = `📥 New lead: ${email}${company ? ` (${company})` : ''}`;
  const text = [
    `New UDGOK CMS lead`,
    ``,
    `Email:   ${email}`,
    `Name:    ${name ?? '—'}`,
    `Company: ${company ?? '—'}`,
    `Source:  ${source}`,
    `Plan:    ${plan ?? '—'}`,
    ``,
    message ? `Message:\n${message}\n` : '',
    `Open:`,
    `https://cms.udgok.com/admin/leads/${leadId}`,
  ]
    .filter(Boolean)
    .join('\n');
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a1a">
      <div style="background:#1a1a1a;color:#fff;padding:10px 14px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;font-size:12px;display:inline-block">
        New Lead · ${source}
      </div>
      <h2 style="font-size:22px;margin:14px 0 6px">${email}</h2>
      <p style="color:#555;margin:0 0 14px">${name ?? '—'}${company ? ` · <b>${company}</b>` : ''}</p>
      ${plan ? `<p style="margin:0 0 10px"><span style="background:#ff6b1f;color:#fff;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Interested in: ${plan}</span></p>` : ''}
      ${message ? `<div style="background:#f5f1ea;border-left:3px solid #ff6b1f;padding:10px 14px;margin-bottom:14px;font-size:13px;white-space:pre-wrap">${escapeHtml(message)}</div>` : ''}
      <a href="https://cms.udgok.com/admin/leads/${leadId}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 16px;font-weight:700;text-decoration:none;font-size:12px;letter-spacing:.1em;text-transform:uppercase">
        View lead →
      </a>
    </div>
  `;
  await sendOwnerAlert({ subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
