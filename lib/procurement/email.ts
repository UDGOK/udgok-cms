/**
 * RFQ email sender (Resend).
 *
 * Spec §8.1:
 *   - Big button *and* raw text link (Outlook/mobile mangle buttons,
 *     reps forward emails — the raw link is the real credential).
 *   - Subject: "Quote request {number} — UDGOK Construction".
 *   - Body must include: line count, needed-by date, our RFQ number,
 *     and a plain "don't forward this" note.
 *   - Body must NOT include: project name, client name, job address.
 *   - Reply-to: purchasing@udgok.com (so the rep hits a human).
 *   - Set up SPF/DKIM/DMARC on udgok.com in Resend BEFORE first
 *     real RFQ. README §6 walks through it.
 *
 * The function returns the magic link URL even on a Resend
 * failure so the buyer can copy-paste it manually. Failing
 * silently in the UI ("email sent, link not visible") is the
 * worst possible UX.
 */

import { Resend } from 'resend';

export type RfqEmailInput = {
  to: string;
  replyTo?: string;
  rfqNumber: string;
  vendorName: string;
  ourCompanyName: string;
  lineCount: number;
  neededBy: Date | null;
  message: string | null;
  url: string;
  expiresAt: Date;
};

const SUBJECT = (n: string) => `Quote request ${n} — UDGOK Construction`;

function text(input: RfqEmailInput): string {
  const needed = input.neededBy
    ? `\nNeeded by: ${input.neededBy.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`
    : '';
  const note = input.message ? `\n\n${input.message}\n` : '';
  return [
    `Hello ${input.vendorName},`,
    '',
    `${input.ourCompanyName} is requesting a quote on ${input.lineCount} line item${
      input.lineCount === 1 ? '' : 's'
    }.`,
    `RFQ number: ${input.rfqNumber}`,
    needed,
    note,
    'Open this private link to enter your prices:',
    input.url,
    '',
    `This link is private to ${input.vendorName}. Please do not forward it.`,
    `It expires on ${input.expiresAt.toLocaleDateString()}.`,
    '',
    'Questions? Reply to this email.',
    `${input.ourCompanyName}`,
  ].join('\n');
}

function html(input: RfqEmailInput): string {
  const needed = input.neededBy
    ? `<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong>Needed by:</strong> ${input.neededBy.toLocaleDateString()}</p>`
    : '';
  const note = input.message
    ? `<div style="margin:16px 0;padding:12px;background:#f5f5f4;border-left:3px solid #2b2b2b;font-size:13px;white-space:pre-wrap;">${escapeHtml(input.message)}</div>`
    : '';
  return `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;padding:32px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#78716c;font-family:ui-monospace,Menlo,monospace;">// REQUEST FOR QUOTE</p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(input.rfqNumber)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e;">From <strong>${escapeHtml(input.ourCompanyName)}</strong> — for ${escapeHtml(input.vendorName)}</p>

    ${needed}
    <p style="margin:8px 0 0;font-size:13px;color:#555;">${input.lineCount} line item${input.lineCount === 1 ? '' : 's'}.</p>

    ${note}

    <p style="margin:24px 0 8px;font-size:14px;">Click below to enter your prices:</p>
    <p style="margin:0 0 8px;">
      <a href="${input.url}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:12px 24px;font-weight:700;font-size:14px;letter-spacing:0.04em;border:2px solid #d97706;">OPEN QUOTE FORM →</a>
    </p>
    <p style="margin:16px 0 0;font-size:11px;color:#78716c;">Or paste this link into your browser:</p>
    <p style="margin:4px 0 0;font-size:11px;color:#444;word-break:break-all;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.url)}</p>

    <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0;">

    <p style="margin:0 0 4px;font-size:11px;color:#78716c;">This link is private to ${escapeHtml(input.vendorName)}. Please do not forward it.</p>
    <p style="margin:0;font-size:11px;color:#78716c;">It expires on ${input.expiresAt.toLocaleDateString()}. Questions? Reply to this email.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type SendRfqResult =
  | { sent: true; resendId?: string }
  | { sent: false; reason: 'NO_API_KEY' | 'NO_FROM' | 'RESEND_ERROR'; message: string; url: string };

/** Send the RFQ. Always returns the magic link URL (even on
 *  Resend failure) so the buyer can copy-paste it manually.
 *  No API key? Returns sent:false with a reason, and the URL
 *  is included so the caller can display "copy this link"
 *  inline instead of "email sent". */
export async function sendRfqEmail(input: RfqEmailInput): Promise<SendRfqResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromName = process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction';

  // Construct the from-address. Order of preference:
  //   1. PROCUREMENT_FROM_EMAIL (already aliased in next.config.mjs)
  //   2. UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN → noreply@<domain>
  //   3. Hard default: noreply@udgok.com (will fail SPF/DKIM
  //      unless udgok.com is set up in Resend — README §6).
  let fromAddress: string;
  const fromRaw = process.env.PROCUREMENT_FROM_EMAIL ?? '';
  if (fromRaw) {
    fromAddress = fromRaw;
  } else {
    const domain = process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN ?? 'udgok.com';
    fromAddress = `noreply@${domain}`;
  }
  const from = fromAddress.includes('<') ? fromAddress : `${fromName} <${fromAddress}>`;

  const htmlBody = html(input);
  const textBody = text(input);
  const subject = SUBJECT(input.rfqNumber);

  if (!apiKey) {
    return {
      sent: false,
      reason: 'NO_API_KEY',
      message:
        'RESEND_API_KEY is not set. Configure it in your Vercel env (and the SPF/DKIM/DMARC records on udgok.com) before sending the first real RFQ.',
      url: input.url,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      replyTo: input.replyTo,
      subject,
      html: htmlBody,
      text: textBody,
      tags: [
        { name: 'type', value: 'rfq' },
        { name: 'rfq', value: input.rfqNumber },
      ],
    });
    if (error) {
      return {
        sent: false,
        reason: 'RESEND_ERROR',
        message: error.message,
        url: input.url,
      };
    }
    return { sent: true, resendId: data?.id };
  } catch (e) {
    return {
      sent: false,
      reason: 'RESEND_ERROR',
      message: e instanceof Error ? e.message : String(e),
      url: input.url,
    };
  }
}

// ───────────────────────────────────────────────────────────────────
//  PO email — sent to the vendor when the buyer issues a PO.
// ───────────────────────────────────────────────────────────────────

export type PoEmailInput = {
  to: string;
  replyTo?: string;
  poNumber: string;
  vendorName: string;
  vendorContactName: string | null;
  ourCompanyName: string;
  total: number;
  neededBy: Date | null;
  shipTo: string | null;
  terms: string | null;
  // PDF rendered ahead of time; attached to the email.
  pdf: Buffer;
};

export type PoEmailResult = {
  sent: boolean;
  resendId?: string;
  reason?: string;
  message?: string;
};

const PO_SUBJECT = (n: string) => `Purchase order ${n} — UDGOK Construction`;

function poText(input: PoEmailInput): string {
  const greet = input.vendorContactName
    ? `Hello ${input.vendorContactName},`
    : `Hello ${input.vendorName},`;
  const needed = input.neededBy
    ? `Needed by: ${input.neededBy.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`
    : null;
  const ship = input.shipTo ? `Ship to: ${input.shipTo}` : null;
  const terms = input.terms ? `Terms: ${input.terms}` : null;
  const meta = [needed, ship, terms].filter(Boolean).join('\n');
  return [
    greet,
    '',
    `${input.ourCompanyName} has issued purchase order ${input.poNumber} to ${input.vendorName}.`,
    '',
    `Total: $${input.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    meta,
    '',
    'The attached PDF is the binding order. Please confirm receipt and any ship date at your earliest convenience.',
    '',
    'Questions? Reply to this email.',
    `${input.ourCompanyName}`,
  ].join('\n');
}

function poHtml(input: PoEmailInput): string {
  const greet = input.vendorContactName
    ? `Hello ${escapeHtml(input.vendorContactName)},`
    : `Hello ${escapeHtml(input.vendorName)},`;
  const meta: string[] = [];
  if (input.neededBy) {
    meta.push(
      `<p style="margin:0 0 4px;font-size:13px;color:#444;"><strong>Needed by:</strong> ${input.neededBy.toLocaleDateString()}</p>`,
    );
  }
  if (input.shipTo) {
    meta.push(
      `<p style="margin:0 0 4px;font-size:13px;color:#444;"><strong>Ship to:</strong> ${escapeHtml(input.shipTo)}</p>`,
    );
  }
  if (input.terms) {
    meta.push(
      `<p style="margin:0 0 4px;font-size:13px;color:#444;"><strong>Terms:</strong> ${escapeHtml(input.terms)}</p>`,
    );
  }
  return `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;padding:32px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#78716c;font-family:ui-monospace,Menlo,monospace;">// PURCHASE ORDER</p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(input.poNumber)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e;">From <strong>${escapeHtml(input.ourCompanyName)}</strong> — for ${escapeHtml(input.vendorName)}</p>
    <p style="margin:0 0 16px;font-size:14px;">${greet}</p>
    <p style="margin:0 0 16px;font-size:14px;">${escapeHtml(input.ourCompanyName)} has issued purchase order <strong>${escapeHtml(input.poNumber)}</strong> to ${escapeHtml(input.vendorName)}.</p>
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;">Total: $${input.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    <div style="margin:16px 0;">${meta.join('')}</div>
    <p style="margin:16px 0;font-size:14px;">The attached PDF is the binding order. Please confirm receipt and any ship date at your earliest convenience.</p>
    <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#78716c;">Questions? Reply to this email.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#78716c;">${escapeHtml(input.ourCompanyName)}</p>
  </div>
</body>
</html>`;
}

export async function sendPoEmail(
  input: PoEmailInput,
): Promise<PoEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromName = process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction';
  let fromAddress: string;
  const fromRaw = process.env.PROCUREMENT_FROM_EMAIL ?? '';
  if (fromRaw) {
    fromAddress = fromRaw;
  } else {
    const domain = process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN ?? 'udgok.com';
    fromAddress = `noreply@${domain}`;
  }
  const from = fromAddress.includes('<') ? fromAddress : `${fromName} <${fromAddress}>`;

  if (!apiKey) {
    return {
      sent: false,
      reason: 'NO_API_KEY',
      message: 'RESEND_API_KEY is not set — PO will not be emailed. Re-issue once env is configured.',
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      replyTo: input.replyTo,
      subject: PO_SUBJECT(input.poNumber),
      html: poHtml(input),
      text: poText(input),
      attachments: [
        {
          filename: `${input.poNumber}.pdf`,
          content: input.pdf,
        },
      ],
      tags: [
        { name: 'type', value: 'po' },
        { name: 'po', value: input.poNumber },
      ],
    });
    if (error) {
      return { sent: false, reason: 'RESEND_ERROR', message: error.message };
    }
    return { sent: true, resendId: data?.id };
  } catch (e) {
    return {
      sent: false,
      reason: 'THROW',
      message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}
