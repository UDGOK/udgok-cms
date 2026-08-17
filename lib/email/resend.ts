import { Resend } from 'resend';
import type { ReactElement } from 'react';
import { env } from '@/lib/env';

let _resend: Resend | null = null;

function client(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — configure Resend first');
  }
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

/**
 * Send a transactional email using a React Email template.
 */
export async function sendEmail({
  to,
  subject,
  react,
  from,
  replyTo,
  text,
}: {
  to: string | string[];
  subject: string;
  /** React Email template */
  react: ReactElement;
  /** Override the default from address for this email. */
  from?: string;
  replyTo?: string;
  /** Plain text fallback (auto-generated from `react` if omitted, but supply for transactional emails). */
  text?: string;
}): Promise<{ id: string }> {
  const result = await client().emails.send({
    from: from ?? env.RESEND_FROM_ADDRESS,
    to: Array.isArray(to) ? to : [to],
    subject,
    react,
    ...(text ? { text } : {}),
    ...(replyTo ? { replyTo } : {}),
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error('Resend returned no data and no error');
  }
  return { id: result.data.id };
}
