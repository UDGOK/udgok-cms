/**
 * Lien Waiver emails — sent to subcontractors when a GC sends
 * them a waiver to sign.
 *
 * Two flavors:
 *   - "initial" — the sub is being asked to sign for the first time
 *   - "reminder" — the GC is following up on an outstanding waiver
 *
 * Both use plain HTML (not React Email) to keep the template
 * simple. The signing flow is the public /lw/[token] route —
 * the link in the email goes there. The token IS the credential;
 * no login required.
 *
 * The "from" address uses the same env shim as the rest of the
 * app (RESEND_FROM_ADDRESS, fallback noreply@udgok.app).
 *
 * Recipients: subcontractor's contactEmail, with the GC able
 * to override the recipient on the detail page.
 */

import { env } from '@/lib/env';

const FROM = () => env.RESEND_FROM_ADDRESS || 'noreply@udgok.app';

interface SendLienWaiverEmailArgs {
  to: string;
  // The GC's display name (the "from" person) — pulled from
  // the user's firstName/lastName in the DB by the caller.
  gcName: string;
  // The project name (e.g. "Clarus Medical Office Buildout")
  projectName: string;
  // The waiver number (e.g. "LW-2026-0001")
  number: string;
  // "Conditional Waiver and Release on Progress Payment" etc.
  typeLabel: string;
  // Amount in cents
  amountCents: number;
  // "Through date" — the last day this waiver releases
  throughDate: Date;
  // "Draw 4" or null for project-level final waivers
  payAppNumber: number | null;
  // Full URL with token, e.g. https://cms.udgok.com/lw/abc123
  signUrl: string;
  // Optional exception text the sub should be aware of
  exceptionText: string | null;
  // For the "reminder" variant — "Days since sent" so the
  // email body can show "you still haven't signed"
  daysSinceSent: number;
  variant: 'initial' | 'reminder';
}

interface SendResult {
  sent: boolean;
  error?: string;
}

/**
 * Send a lien waiver email via Resend. Caller is responsible for
 * verifying the email address is valid (this function just sends
 * to whatever string it's given).
 */
export async function sendLienWaiverEmail({
  to,
  gcName,
  projectName,
  number,
  typeLabel,
  amountCents,
  throughDate,
  payAppNumber,
  signUrl,
  exceptionText,
  daysSinceSent,
  variant,
}: SendLienWaiverEmailArgs): Promise<SendResult> {
  const subject =
    variant === 'initial'
      ? `Sign your lien waiver for ${projectName} — ${number}`
      : `Reminder: please sign ${number} for ${projectName}`;

  const html = renderHtml({
    gcName,
    projectName,
    number,
    typeLabel,
    amountCents,
    throughDate,
    payAppNumber,
    signUrl,
    exceptionText,
    daysSinceSent,
    variant,
  });
  const text = renderText({
    gcName,
    projectName,
    number,
    typeLabel,
    amountCents,
    throughDate,
    payAppNumber,
    signUrl,
    exceptionText,
    daysSinceSent,
    variant,
  });
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
}): Promise<SendResult> {
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

const fmtUsd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function renderHtml(args: Omit<SendLienWaiverEmailArgs, 'to'>): string {
  const {
    gcName,
    projectName,
    number,
    typeLabel,
    amountCents,
    throughDate,
    payAppNumber,
    signUrl,
    exceptionText,
    daysSinceSent,
    variant,
  } = args;
  const isReminder = variant === 'reminder';
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#fff">
  <div style="background:${isReminder ? '#a16207' : '#ff6b1f'};color:#fff;padding:8px 14px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;font-size:11px;display:inline-block">
    ${isReminder ? `Reminder · ${daysSinceSent} days outstanding` : 'Action required · Lien waiver'}
  </div>

  <h1 style="font-size:22px;margin:18px 0 6px;line-height:1.2">${escapeHtml(typeLabel)}</h1>
  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#666;margin-bottom:16px">
    ${escapeHtml(number)} · ${escapeHtml(projectName)}${payAppNumber != null ? ` · Draw #${payAppNumber}` : ''}
  </div>

  <p style="color:#333;line-height:1.55;margin:0 0 14px">
    ${isReminder
      ? `Hi — ${escapeHtml(gcName)} asked us to follow up on this waiver. You haven't signed it yet, and they need it on file before processing the next payment. It only takes a minute.`
      : `${escapeHtml(gcName)} has prepared a lien waiver for your work on <b>${escapeHtml(projectName)}</b>. Please review the terms and sign electronically — no account or login required.`
    }
  </p>

  <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;border:2px solid #1a1a1a">
    <tr>
      <td style="padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666;border-bottom:1px solid #ddd;width:40%">Amount</td>
      <td style="padding:10px 14px;font-weight:700;font-size:16px;border-bottom:1px solid #ddd">${fmtUsd(amountCents)}</td>
    </tr>
    <tr>
      <td style="padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666;border-bottom:1px solid #ddd">Releases work through</td>
      <td style="padding:10px 14px;font-weight:600;border-bottom:1px solid #ddd">${fmtDate(throughDate)}</td>
    </tr>
    ${payAppNumber != null ? `
    <tr>
      <td style="padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666;border-bottom:1px solid #ddd">Pay application</td>
      <td style="padding:10px 14px;border-bottom:1px solid #ddd">Draw #${payAppNumber}</td>
    </tr>` : ''}
    <tr>
      <td style="padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666">Document</td>
      <td style="padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px">${escapeHtml(number)}</td>
    </tr>
  </table>

  ${exceptionText ? `
  <div style="background:#fef3c7;border-left:4px solid #a16207;padding:12px 14px;margin:18px 0">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#92400e;font-weight:700;margin-bottom:4px">Exceptions / reservations</div>
    <div style="font-size:14px;color:#1a1a1a;white-space:pre-wrap">${escapeHtml(exceptionText)}</div>
  </div>
  ` : ''}

  <div style="text-align:center;margin:28px 0">
    <a href="${escapeHtml(signUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 28px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;font-size:14px">
      Review and sign →
    </a>
  </div>

  <p style="color:#666;font-size:13px;line-height:1.55;margin:18px 0 0">
    Or paste this link into your browser:<br>
    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;word-break:break-all;color:#1a1a1a">${escapeHtml(signUrl)}</span>
  </p>

  <hr style="border:none;border-top:1px solid #ddd;margin:28px 0 16px">
  <p style="color:#999;font-size:11px;line-height:1.5;margin:0">
    This waiver is governed by Oklahoma Title 42 (mechanic's lien statute).
    The typed name on the next page is your electronic signature.
    Questions? Reply directly to this email to reach ${escapeHtml(gcName)}.
  </p>
</div>
`;
}

function renderText(args: Omit<SendLienWaiverEmailArgs, 'to'>): string {
  const {
    gcName,
    projectName,
    number,
    typeLabel,
    amountCents,
    throughDate,
    payAppNumber,
    signUrl,
    exceptionText,
    daysSinceSent,
    variant,
  } = args;
  const isReminder = variant === 'reminder';
  return [
    `${typeLabel}`,
    `${number} · ${projectName}${payAppNumber != null ? ` · Draw #${payAppNumber}` : ''}`,
    '',
    isReminder
      ? `Hi — ${gcName} asked us to follow up on this waiver. You haven't signed it yet, and they need it on file before processing the next payment. It only takes a minute.`
      : `${gcName} has prepared a lien waiver for your work on ${projectName}. Please review the terms and sign electronically — no account or login required.`,
    '',
    `Amount:          ${fmtUsd(amountCents)}`,
    `Releases through: ${fmtDate(throughDate)}`,
    payAppNumber != null ? `Pay application:   Draw #${payAppNumber}` : null,
    `Document:        ${number}`,
    isReminder ? `Outstanding:       ${daysSinceSent} day${daysSinceSent === 1 ? '' : 's'}` : null,
    exceptionText ? `\nExceptions:\n${exceptionText}\n` : null,
    `Review and sign here: ${signUrl}`,
    '',
    `This waiver is governed by Oklahoma Title 42 (mechanic's lien statute).`,
    `Questions? Reply to this email to reach ${gcName}.`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** Minimal HTML escape for the email template — emails are a different trust boundary. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
