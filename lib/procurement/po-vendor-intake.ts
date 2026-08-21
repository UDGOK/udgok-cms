/**
 * Public vendor portal — PO response intake action.
 *
 * Called from the /p/[token] page when the vendor clicks
 * Accept / Counter / Reject. No Clerk session — the token
 * is the credential, validated against the SHA-256 hash
 * stored on the PO. Tenant-scoped via the PO's workspaceId
 * (which we look up after token validation).
 *
 * Every successful submission writes:
 *   1. PoVendorResponse row
 *   2. PoVendorResponseLine rows (one per PO line)
 *   3. PoEvent row (VENDOR_RESPONSE_SUBMITTED)
 *   4. Updates PO (vendorResponseId, paymentMethodChosen,
 *      paymentMethodDetail, vendorReference, lastActivityAt,
 *      and acknowledgedAt if ACCEPTED)
 *
 * On COUNTERED, the PO stays ISSUED and we wait for the
 * buyer to accept/reject the counter. On REJECTED, the PO
 * transitions to CANCELLED (vendor said no).
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { sha256 } from './token';
import { rateLimit } from './rateLimit';
import { headers } from 'next/headers';

const submitResponseSchema = z.object({
  token: z.string().min(16).max(128),
  responseType: z.enum(['ACCEPTED', 'COUNTERED', 'REJECTED', 'INFO_ONLY']),
  paymentMethod: z.enum(['ON_FILE', 'PAYMENT_LINK', 'INVOICE_BY_EMAIL', 'CHECK']),
  paymentMethodDetail: z.string().max(200).optional().or(z.literal('')),
  vendorReference: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(4000).optional().or(z.literal('')),
  signedByName: z.string().min(1, 'Name is required').max(200),
  signedByEmail: z.string().email('Valid email required'),
  signedByPhone: z.string().max(40).optional().or(z.literal('')),
  lines: z
    .array(
      z.object({
        poLineId: z.string().min(1),
        isConfirmed: z.boolean(),
        confirmedQty: z.coerce.number().min(0).optional(),
        confirmedPrice: z.coerce.number().min(0).optional(),
        backorderQty: z.coerce.number().min(0).optional(),
        shipDate: z.string().optional().or(z.literal('')),
        substituteSku: z.string().max(200).optional().or(z.literal('')),
        substituteDescription: z.string().max(500).optional().or(z.literal('')),
        notes: z.string().max(2000).optional().or(z.literal('')),
      }),
    )
    .min(0),
});

export type SubmitPoResponseInput = z.infer<typeof submitResponseSchema>;
export type SubmitPoResponseResult =
  | { ok: true; responseId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitPoResponseAction(
  input: SubmitPoResponseInput,
): Promise<SubmitPoResponseResult> {
  const parsed = submitResponseSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // IP rate limit by token-hash so a single vendor can't
  // hammer the endpoint. 10 submissions per 10 minutes.
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await rateLimit(`po-submit:${ip}`, { max: 10, windowSec: 600 });
  if (!rl.ok) {
    return { ok: false, error: 'Too many submissions — please wait a few minutes and try again.' };
  }

  const tokenHash = sha256(parsed.data.token);
  const po = await prisma.purchaseOrder.findFirst({
    where: { vendorPortalToken: tokenHash },
    select: {
      id: true,
      workspaceId: true,
      number: true,
      status: true,
    },
  });
  if (!po) {
    return { ok: false, error: 'This link is no longer valid.' };
  }
  if (po.status === 'CANCELLED') {
    return { ok: false, error: 'This PO has been cancelled.' };
  }
  if (po.status !== 'ISSUED' && po.status !== 'ACKNOWLEDGED') {
    return { ok: false, error: 'This PO is not in a state that accepts responses.' };
  }

  // Build the response with lines in a single transaction.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const response = await tx.poVendorResponse.create({
        data: {
          workspaceId: po.workspaceId,
          poId: po.id,
          responseType: parsed.data.responseType,
          paymentMethod: parsed.data.paymentMethod,
          paymentMethodDetail: parsed.data.paymentMethodDetail || null,
          vendorReference: parsed.data.vendorReference || null,
          notes: parsed.data.notes || null,
          signedByName: parsed.data.signedByName,
          signedByEmail: parsed.data.signedByEmail,
          signedByPhone: parsed.data.signedByPhone || null,
          ipAddress: ip,
          lines: parsed.data.lines.length > 0
            ? {
                create: parsed.data.lines.map((l) => ({
                  workspaceId: po.workspaceId,
                  poLineId: l.poLineId,
                  isConfirmed: l.isConfirmed,
                  confirmedQty: l.confirmedQty != null ? l.confirmedQty : null,
                  confirmedPrice: l.confirmedPrice != null ? l.confirmedPrice : null,
                  backorderQty: l.backorderQty != null ? l.backorderQty : null,
                  shipDate: l.shipDate ? new Date(l.shipDate) : null,
                  substituteSku: l.substituteSku || null,
                  substituteDescription: l.substituteDescription || null,
                  notes: l.notes || null,
                })),
              }
            : undefined,
        },
        select: { id: true },
      });

      // Update the PO with the latest response pointer +
      // denormalized payment fields. Status transitions:
      //   ACCEPTED   → acknowledgedAt = now (status stays ISSUED)
      //   COUNTERED  → status stays ISSUED, awaiting our decision
      //   REJECTED   → status → CANCELLED (vendor said no)
      //   INFO_ONLY  → no status change
      const data: Record<string, unknown> = {
        vendorResponseId: response.id,
        paymentMethodChosen: parsed.data.paymentMethod,
        paymentMethodDetail: parsed.data.paymentMethodDetail || null,
        vendorReference: parsed.data.vendorReference || null,
        lastActivityAt: new Date(),
      };
      if (parsed.data.responseType === 'ACCEPTED') {
        data.acknowledgedAt = new Date();
      }
      if (parsed.data.responseType === 'REJECTED') {
        data.status = 'CANCELLED';
      }
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data,
      });

      // Audit log entry — same pattern as RfqEvent.
      await tx.poEvent.create({
        data: {
          workspaceId: po.workspaceId,
          poId: po.id,
          type: 'VENDOR_RESPONSE_SUBMITTED',
          actor: null, // vendor — no Clerk user
          meta: {
            responseType: parsed.data.responseType,
            paymentMethod: parsed.data.paymentMethod,
            signedByName: parsed.data.signedByName,
            signedByEmail: parsed.data.signedByEmail,
            lineCount: parsed.data.lines.length,
          },
        },
      });

      return response;
    });

    revalidatePath(`/p/${parsed.data.token}`);
    return { ok: true, responseId: result.id };
  } catch (err) {
    console.error('[po-vendor-intake] submit failed:', err);
    return { ok: false, error: 'Could not save your response. Please try again or email ap@udgok.com.' };
  }
}
