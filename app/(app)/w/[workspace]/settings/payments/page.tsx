/**
 * Workspace payment settings — invoice email + payment
 * method toggles + per-vendor payment methods editor.
 *
 * Singleton per workspace. OWNER + ADMIN only — these
 * settings flow into every PO email and every vendor
 * portal render, so write access is restricted.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { getWorkspacePaymentSettings } from '@/lib/procurement/payment-settings';
import { PaymentsSettingsForm } from './PaymentsSettingsForm';
import { VendorPaymentMethodsTable } from './VendorPaymentMethodsTable';

export const dynamic = 'force-dynamic';

export default async function PaymentsSettingsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace, userId, membership } = await requireMembership(params.workspace);
  const master = await isMasterAdmin(userId);
  if (!master && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    redirect(`/w/${workspace.slug}/settings`);
  }

  const settings = await getWorkspacePaymentSettings(workspace.id);

  // Pull every vendor with their payment methods for the
  // per-vendor editor. We pull ALL vendors (including
  // archived) so the user can see the full picture.
  const vendors = await prisma.vendor.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      paymentMethods: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href={`/w/${workspace.slug}/settings`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Settings
      </Link>
      <div className="mt-2 mb-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {'// Workspace settings'}
        </div>
        <h1 className="text-2xl font-black">Payments & invoicing</h1>
        <p className="text-[12px] text-ink-70 mt-1">
          Where vendors send invoices, which payment methods you accept, and the ACH / card / check
          details you have on file for each vendor.
        </p>
      </div>

      <PaymentsSettingsForm
        workspaceSlug={workspace.slug}
        initial={settings}
      />

      <div className="mt-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
          {'// Vendor payment methods'}
        </div>
        <VendorPaymentMethodsTable
          workspaceSlug={workspace.slug}
          vendors={vendors.map((v) => ({
            id: v.id,
            name: v.name,
            methods: v.paymentMethods.map((m) => ({
              id: m.id,
              methodType: m.methodType,
              isDefault: m.isDefault,
              nickname: m.nickname,
              last4: m.last4,
              achBankName: m.achBankName,
              achAccountLast4: m.achAccountLast4,
              cardBrand: m.cardBrand,
              isActive: m.isActive,
            })),
          }))}
        />
      </div>
    </div>
  );
}
