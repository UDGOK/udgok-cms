'use server';

import { headers } from 'next/headers';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';

export type ContactFormState =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | undefined;

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().max(120).optional().or(z.literal('')),
  company: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  source: z.string().max(40).default('contact'),
  plan: z.string().max(40).optional().or(z.literal('')),
  page: z.string().max(200).optional().or(z.literal('')),
  message: z.string().min(10, 'Tell us a bit about what you need (10+ characters)').max(2000),
});

/**
 * Submit a contact / "Talk to sales" / enterprise inquiry.
 *
 * - Saves the lead to `MarketingLead`
 * - Sends an owner alert email so the platform owner can follow up
 * - Returns a thank-you state
 *
 * Best-effort: the lead insert happens first, then the email. If the
 * email fails, the lead is still in the DB.
 */
export async function submitContactForm(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const raw = {
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    name: String(formData.get('name') ?? '').trim(),
    company: String(formData.get('company') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    source: String(formData.get('source') ?? 'contact').trim() || 'contact',
    plan: String(formData.get('plan') ?? '').trim(),
    page: String(formData.get('page') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
  };

  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors };
  }

  // Capture request metadata for context
  let referer: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    referer = h.get('referer');
    userAgent = h.get('user-agent');
  } catch {
    // headers() can fail outside Next context; non-fatal
  }

  let leadId: string;
  try {
    const lead = await prisma.marketingLead.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name || null,
        company: parsed.data.company || null,
        phone: parsed.data.phone || null,
        source: parsed.data.source,
        plan: parsed.data.plan || null,
        page: parsed.data.page || null,
        message: parsed.data.message,
        metadata: {
          referer,
          userAgent,
        },
      },
      select: { id: true },
    });
    leadId = lead.id;
  } catch (err) {
    console.error('[contact] DB insert failed', err);
    return {
      ok: false,
      error: 'We couldn’t save your message. Please try again or email us directly.',
    };
  }

  // Best-effort owner alert
  try {
    const { sendNewLeadAlert } = await import('@/lib/email/owner-alerts');
    await sendNewLeadAlert({
      leadId,
      email: parsed.data.email,
      name: parsed.data.name || null,
      company: parsed.data.company || null,
      source: parsed.data.source,
      plan: parsed.data.plan || null,
      message: parsed.data.message,
    });
  } catch (err) {
    console.warn('[contact] owner alert failed (non-fatal)', err);
  }

  return {
    ok: true,
    message:
      parsed.data.source === 'enterprise'
        ? 'Thanks — Yasir will be in touch within 1 business day to walk through pricing for your team.'
        : 'Thanks — we’ll be in touch within 1 business day.',
  };
}
