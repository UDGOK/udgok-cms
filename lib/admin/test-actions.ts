'use server';

import { z } from '@/lib/validation';
import { auth } from '@clerk/nextjs/server';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { Resend } from 'resend';

const testEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200).optional(),
});

export type TestEmailState =
  | {
      error?: string;
      ok?: boolean;
      messageId?: string;
      fromAddress?: string;
      envCheck?: {
        RESEND_API_KEY: boolean;
        RESEND_FROM_ADDRESS: string | null;
        NEXT_PUBLIC_APP_URL: string | null;
      };
    }
  | undefined;

export async function sendTestEmailAction(
  _prev: TestEmailState,
  formData: FormData,
): Promise<TestEmailState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  if (!(await isMasterAdmin(userId))) {
    return { error: 'Master admin access required' };
  }

  const parsed = testEmailSchema.safeParse({
    to: formData.get('to'),
    subject: formData.get('subject') || undefined,
  });
  if (!parsed.success) return { error: 'Invalid email address' };

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    process.env.RESEND_FROM_ADDRESS ??
    (process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN
      ? `noreply@${process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN}`
      : 'noreply@udgok.app');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';

  const envCheck = {
    RESEND_API_KEY: !!apiKey,
    RESEND_FROM_ADDRESS: process.env.RESEND_FROM_ADDRESS ?? null,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
  };

  if (!apiKey) {
    return {
      error: 'RESEND_API_KEY is not set in Vercel environment. Add it in Vercel → Project Settings → Environment Variables.',
      envCheck,
      fromAddress,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: parsed.data.to,
      subject: parsed.data.subject ?? '🧪 UDGOK CMS — Test email',
      html: `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e2a3a; color: #f5f1ea; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">UDGOK CMS</h1>
            <p style="margin: 8px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; color: #f06a2d;">Test Email</p>
          </div>
          <div style="padding: 24px; background: #f5f1ea;">
            <p>Hi there,</p>
            <p>This is a test email sent from your UDGOK CMS master admin panel.</p>
            <p><strong>If you received this, your email delivery is working correctly.</strong></p>
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 11px; color: #777;">FROM</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 12px;">${fromAddress}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 11px; color: #777;">TO</td><td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 12px;">${parsed.data.to}</td></tr>
              <tr><td style="padding: 8px; font-family: monospace; font-size: 11px; color: #777;">APP URL</td><td style="padding: 8px; font-family: monospace; font-size: 12px;">${appUrl}</td></tr>
            </table>
            <p>— The UDGOK team</p>
          </div>
        </div>
      `,
    });

    if (error) {
      return { error: `Resend error: ${error.message}`, envCheck, fromAddress };
    }

    return { ok: true, messageId: data?.id, envCheck, fromAddress };
  } catch (err) {
    return {
      error: `Send failed: ${err instanceof Error ? err.message : String(err)}`,
      envCheck,
      fromAddress,
    };
  }
}
