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

/**
 * Render the RFQ email body without sending. Used by the
 * PII redaction test (`__tests__/email-pii.test.ts`) and
 * any preview tooling. NOT for production use — the public
 * path is `sendRfqEmail` which adds the magic link.
 */
export function renderRfqEmail(input: RfqEmailInput): { subject: string; text: string; html: string } {
  return {
    subject: SUBJECT(input.rfqNumber),
    text: text(input),
    html: html(input),
  };
}

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
  // Delivery block (separate from shipTo) — the driver
  // needs to see where to physically drop off + who to
  // call at the site. Always rendered if any field is set.
  deliveryName: string | null;
  deliveryAddress: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryContactEmail: string | null;
  // Vendor portal URL — the link the vendor uses to
  // acknowledge / counter / reject / send invoice. Goes
  // into the body so the vendor has a single-click path.
  portalUrl?: string | null;
  // The invoice email the vendor should send final
  // invoices to. Comes from workspace payment settings.
  invoiceEmail?: string | null;
  // BCC — the buyer's purchasing inbox gets a copy for
  // records. Comes from PROCUREMENT_BCC_EMAIL env var; if
  // unset, no BCC.
  bcc?: string;
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
  // Delivery block — only render if any field is set.
  const hasDelivery =
    input.deliveryAddress || input.deliveryName || input.deliveryContactName;
  const deliveryLines: string[] = [];
  if (hasDelivery) {
    deliveryLines.push('', 'DELIVERY — driver drop-off + on-site point of contact:');
    if (input.deliveryName) deliveryLines.push(`  Site: ${input.deliveryName}`);
    if (input.deliveryAddress) deliveryLines.push(`  Address: ${input.deliveryAddress}`);
    if (input.deliveryContactName) {
      deliveryLines.push(`  On-site PoC: ${input.deliveryContactName}`);
      if (input.deliveryContactPhone) {
        deliveryLines.push(`  Phone: ${input.deliveryContactPhone}`);
      }
      if (input.deliveryContactEmail) {
        deliveryLines.push(`  Email: ${input.deliveryContactEmail}`);
      }
    }
  }
  return [
    greet,
    '',
    `${input.ourCompanyName} has issued purchase order ${input.poNumber} to ${input.vendorName}.`,
    '',
    `Total: $${input.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    meta,
    ...deliveryLines,
    '',
    'The attached PDF is the binding order. Please confirm receipt and any ship date at your earliest convenience.',
    '',
    input.portalUrl
      ? [
          '',
          '────────────────────────────────────────',
          'Acknowledge, counter, or send invoice:',
          `  ${input.portalUrl}`,
          '',
          'Payment options:',
          '  • ACH on file',
          '  • Send me a payment link',
          `  • Invoice by email — send to ${input.invoiceEmail ?? 'ap@udgok.com'}`,
          '  • Pay by check (mailing instructions on the portal)',
          '────────────────────────────────────────',
        ].join('\n')
      : '',
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
  // Delivery block — only render if any field is set.
  // Visually distinct (orange left border) so the vendor's
  // dispatcher sees it without scrolling.
  const hasDelivery =
    input.deliveryAddress || input.deliveryName || input.deliveryContactName;
  const deliveryHtml = hasDelivery
    ? `<div style="margin:20px 0;padding:14px 16px;background:#fff7ed;border-left:3px solid #ff5a1f;border-radius:2px;">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#78716c;font-family:ui-monospace,Menlo,monospace;">// DELIVERY — driver drop-off + on-site point of contact</p>
        ${input.deliveryName ? `<p style="margin:0 0 4px;font-size:13px;color:#1a1a1a;"><strong>Site:</strong> ${escapeHtml(input.deliveryName)}</p>` : ''}
        ${input.deliveryAddress ? `<p style="margin:0 0 4px;font-size:13px;color:#1a1a1a;"><strong>Address:</strong> ${escapeHtml(input.deliveryAddress)}</p>` : ''}
        ${input.deliveryContactName ? `<p style="margin:0 0 4px;font-size:13px;color:#1a1a1a;"><strong>On-site PoC:</strong> ${escapeHtml(input.deliveryContactName)}${input.deliveryContactPhone ? ` · <span style="font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.deliveryContactPhone)}</span>` : ''}${input.deliveryContactEmail ? ` · <span style="font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.deliveryContactEmail)}</span>` : ''}</p>` : ''}
      </div>`
    : '';
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
    ${deliveryHtml}
    <p style="margin:16px 0;font-size:14px;">The attached PDF is the binding order. Please confirm receipt and any ship date at your earliest convenience.</p>
    ${
      input.portalUrl
        ? `<div style="margin:24px 0;padding:18px 20px;background:#1a1a1a;color:#ffffff;border-radius:2px;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a8a29e;font-family:ui-monospace,Menlo,monospace;">// ACKNOWLEDGE / COUNTER / INVOICE</p>
        <p style="margin:0 0 12px;font-size:15px;">Use the portal to confirm this PO, propose changes, pick how you'd like to be paid, and send your final invoice.</p>
        <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;padding:11px 22px;text-decoration:none;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Open PO Portal →</a>
        <p style="margin:14px 0 0;font-size:11px;color:#a8a29e;font-family:ui-monospace,Menlo,monospace;word-break:break-all;">${escapeHtml(input.portalUrl)}</p>
        <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#d6d3d1;">Payment options: <strong>ACH on file</strong> · <strong>Send me a payment link</strong> · <strong>Invoice by email</strong> — send to <span style="font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.invoiceEmail ?? 'ap@udgok.com')}</span> · <strong>Pay by check</strong> (mailing instructions on the portal)</p>
      </div>`
        : ''
    }
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
    // BCC: buyer's purchasing inbox. Sourced from the input
    // (preferred — caller knows the right address) with
    // PROCUREMENT_BCC_EMAIL as fallback. If neither is set,
    // no BCC is added.
    const bcc = input.bcc ?? process.env.PROCUREMENT_BCC_EMAIL;
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      ...(bcc ? { bcc: [bcc] } : {}),
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

// =====================================================================
//  Vendor response notification + invoice request
// =====================================================================
//
// Internal-side notifications fired when a vendor responds
// to a PO at /p/[token] or when we ask them to send us an
// invoice. Sent to the buyer's PM + AP (not the vendor —
// they got their own confirmation via the portal).

export type VendorNotificationInput = {
  to: string;
  subject: string;
  workspaceName: string;
  poNumber: string;
  vendorName: string;
  // 'VENDOR_RESPONSE' | 'INVOICE_REQUEST'
  responseType: 'VENDOR_RESPONSE' | 'INVOICE_REQUEST';
  paymentMethod?:
    | 'ON_FILE'
    | 'PAYMENT_LINK'
    | 'INVOICE_BY_EMAIL'
    | 'CHECK'
    | null;
  portalUrl?: string | null;
  invoiceEmail?: string;
  lineCount?: number;
  notes?: string | null;
};

function vendorNotificationText(input: VendorNotificationInput): string {
  const portal = input.portalUrl ? `\n  Portal: ${input.portalUrl}\n` : '';
  const method = input.paymentMethod
    ? `\n  Payment method: ${input.paymentMethod.replace(/_/g, ' ').toLowerCase()}\n`
    : '';
  if (input.responseType === 'INVOICE_REQUEST') {
    return `Invoice needed for ${input.poNumber}

Hi,

We need the final invoice for ${input.poNumber} (${input.vendorName}).

Please send it to:
  ${input.invoiceEmail ?? 'ap@udgok.com'}
with the PO number in the subject line.

You can also upload it via the portal:
  ${input.portalUrl ?? '(no portal link — request a new one from the buyer)'}

Payment terms: as quoted on the PO.

— ${input.workspaceName}
`;
  }
  return `${input.vendorName} responded to ${input.poNumber}
${portal}${method}Lines: ${input.lineCount ?? '—'}

${input.notes ? `Vendor notes:\n${input.notes}\n` : ''}
— ${input.workspaceName}
`;
}

function vendorNotificationHtml(input: VendorNotificationInput): string {
  const safe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const portal = input.portalUrl
    ? `<p style="margin:12px 0"><a href="${safe(input.portalUrl)}" style="display:inline-block;background:#1e2a3a;color:#f5f1e8;padding:10px 20px;text-decoration:none;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-size:11px">Open PO</a></p>`
    : '';
  const method = input.paymentMethod
    ? `<p style="margin:8px 0"><b>Payment method:</b> ${safe(input.paymentMethod.replace(/_/g, ' ').toLowerCase())}</p>`
    : '';
  if (input.responseType === 'INVOICE_REQUEST') {
    return `<div style="font-family:Helvetica,sans-serif;color:#1e2a3a;max-width:560px">
<p>Hi,</p>
<p>We need the final invoice for <b>${safe(input.poNumber)}</b> (${safe(input.vendorName)}).</p>
<p>Please send it to <a href="mailto:${safe(input.invoiceEmail ?? 'ap@udgok.com')}">${safe(input.invoiceEmail ?? 'ap@udgok.com')}</a> with the PO number in the subject line.</p>
${portal}
<p>Payment terms: as quoted on the PO.</p>
<p style="color:#7c8694">— ${safe(input.workspaceName)}</p>
</div>`;
  }
  return `<div style="font-family:Helvetica,sans-serif;color:#1e2a3a;max-width:560px">
<p>${safe(input.vendorName)} responded to <b>${safe(input.poNumber)}</b></p>
${method}
${input.lineCount ? `<p><b>Lines:</b> ${input.lineCount}</p>` : ''}
${input.notes ? `<p style="white-space:pre-wrap;background:#ebe6d7;padding:8px 12px;border-left:3px solid #ff5a1f">${safe(input.notes)}</p>` : ''}
${portal}
<p style="color:#7c8694">— ${safe(input.workspaceName)}</p>
</div>`;
}

export async function sendVendorResponseNotification(
  input: VendorNotificationInput,
): Promise<{ sent: boolean; reason?: string; message?: string; resendId?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'NO_RESEND_KEY' };
  }
  const from =
    process.env.RESEND_FROM_ADDRESS ?? 'noreply@cms.udgok.com';
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: vendorNotificationText(input),
      html: vendorNotificationHtml(input),
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
