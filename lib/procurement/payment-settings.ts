/**
 * Workspace payment settings — singleton per workspace.
 *
 * The buyer configures the invoice email + default terms
 * + per-method toggles here. We read it at:
 *   - PO issue time (to embed invoice email in the PO body)
 *   - Vendor portal render time (to show the right payment
 *     options to the vendor)
 *   - Settings page render time
 *
 * Lazy-create: the first read for a workspace creates the
 * row with sensible defaults. The settings page is the
 * canonical place to edit.
 */

import { prisma } from '@/lib/db/client';

export type PaymentSettingsShape = {
  invoiceEmail: string;
  invoiceEmailCc: string | null;
  defaultTerms: string;
  paymentLinkBaseUrl: string | null;
  achInstructions: string | null;
  checkPayableTo: string | null;
  checkMailTo: string | null;
  allowAch: boolean;
  allowCard: boolean;
  allowCheck: boolean;
  allowPaymentLink: boolean;
};

const DEFAULTS: PaymentSettingsShape = {
  invoiceEmail: 'ap@udgok.com',
  invoiceEmailCc: null,
  defaultTerms: 'Net 30',
  paymentLinkBaseUrl: null,
  achInstructions: null,
  checkPayableTo: 'UDGOK Construction',
  checkMailTo: null,
  allowAch: true,
  allowCard: false,
  allowCheck: true,
  allowPaymentLink: false,
};

export async function getWorkspacePaymentSettings(
  workspaceId: string,
): Promise<PaymentSettingsShape> {
  const row = await prisma.workspacePaymentSettings.findUnique({
    where: { workspaceId },
  });
  if (!row) {
    // Lazy-create with defaults.
    const created = await prisma.workspacePaymentSettings.create({
      data: { workspaceId, ...DEFAULTS },
    });
    return toShape(created);
  }
  return toShape(row);
}

function toShape(row: {
  invoiceEmail: string;
  invoiceEmailCc: string | null;
  defaultTerms: string;
  paymentLinkBaseUrl: string | null;
  achInstructions: string | null;
  checkPayableTo: string | null;
  checkMailTo: string | null;
  allowAch: boolean;
  allowCard: boolean;
  allowCheck: boolean;
  allowPaymentLink: boolean;
}): PaymentSettingsShape {
  return {
    invoiceEmail: row.invoiceEmail,
    invoiceEmailCc: row.invoiceEmailCc,
    defaultTerms: row.defaultTerms,
    paymentLinkBaseUrl: row.paymentLinkBaseUrl,
    achInstructions: row.achInstructions,
    checkPayableTo: row.checkPayableTo,
    checkMailTo: row.checkMailTo,
    allowAch: row.allowAch,
    allowCard: row.allowCard,
    allowCheck: row.allowCheck,
    allowPaymentLink: row.allowPaymentLink,
  };
}
