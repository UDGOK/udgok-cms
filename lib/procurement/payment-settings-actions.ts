/**
 * Workspace payment settings actions + vendor payment
 * methods CRUD. Both are OWNER/ADMIN only — these flow
 * into every PO email and every vendor portal render.
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { assertRole } from './auth';

const settingsSchema = z.object({
  workspaceSlug: z.string().min(1),
  invoiceEmail: z.string().email('Valid invoice email required'),
  invoiceEmailCc: z.string().email().optional().nullable().or(z.literal('')),
  defaultTerms: z.string().max(60).default('Net 30'),
  paymentLinkBaseUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .nullable()
    .or(z.literal('')),
  achInstructions: z.string().max(2000).optional().nullable().or(z.literal('')),
  checkPayableTo: z.string().max(200).optional().nullable().or(z.literal('')),
  checkMailTo: z.string().max(500).optional().nullable().or(z.literal('')),
  allowAch: z.boolean().default(true),
  allowCard: z.boolean().default(false),
  allowCheck: z.boolean().default(true),
  allowPaymentLink: z.boolean().default(false),
});

export type SavePaymentSettingsResult = { ok: true } | { ok: false; error: string };

export async function savePaymentSettingsAction(
  input: z.input<typeof settingsSchema>,
): Promise<SavePaymentSettingsResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const workspace = await getWorkspace(parsed.data.workspaceSlug);
  if (!workspace) return { ok: false, error: 'Workspace not found' };
  try {
    await assertRole(workspace.id, ['OWNER', 'ADMIN']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  // Upsert. Singleton per workspace — the row already
  // exists if anyone has read it (getWorkspacePaymentSettings
  // lazy-creates with defaults).
  await prisma.workspacePaymentSettings.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      invoiceEmail: parsed.data.invoiceEmail,
      invoiceEmailCc: parsed.data.invoiceEmailCc || null,
      defaultTerms: parsed.data.defaultTerms,
      paymentLinkBaseUrl: parsed.data.paymentLinkBaseUrl || null,
      achInstructions: parsed.data.achInstructions || null,
      checkPayableTo: parsed.data.checkPayableTo || null,
      checkMailTo: parsed.data.checkMailTo || null,
      allowAch: parsed.data.allowAch,
      allowCard: parsed.data.allowCard,
      allowCheck: parsed.data.allowCheck,
      allowPaymentLink: parsed.data.allowPaymentLink,
    },
    update: {
      invoiceEmail: parsed.data.invoiceEmail,
      invoiceEmailCc: parsed.data.invoiceEmailCc || null,
      defaultTerms: parsed.data.defaultTerms,
      paymentLinkBaseUrl: parsed.data.paymentLinkBaseUrl || null,
      achInstructions: parsed.data.achInstructions || null,
      checkPayableTo: parsed.data.checkPayableTo || null,
      checkMailTo: parsed.data.checkMailTo || null,
      allowAch: parsed.data.allowAch,
      allowCard: parsed.data.allowCard,
      allowCheck: parsed.data.allowCheck,
      allowPaymentLink: parsed.data.allowPaymentLink,
    },
  });

  revalidatePath(`/w/${parsed.data.workspaceSlug}/settings/payments`);
  return { ok: true };
}
