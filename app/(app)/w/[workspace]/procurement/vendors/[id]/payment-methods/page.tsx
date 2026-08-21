/**
 * Per-vendor payment methods page.
 *
 * Linked from the vendor detail page. Shows the vendor's
 * accepted payment methods (their bank / card / check
 * details) so the buyer knows where to send payment.
 *
 * Reachable from:
 *   - Vendor detail page → "Payment methods" link
 *   - Workspace payment settings → per-vendor list
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { VendorPaymentMethodsEditor } from '../VendorPaymentMethodsEditor';

export const dynamic = 'force-dynamic';

export default async function VendorPaymentMethodsPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const vendor = await prisma.vendor.findFirst({
    where: { id: params.id, workspaceId: workspace.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      paymentMethods: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!vendor) notFound();

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement/vendors/${vendor.id}`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← {vendor.name}
      </Link>
      <div className="mt-2 mb-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {'// Vendor · payment methods'}
        </div>
        <h1 className="text-2xl font-black mt-1">{vendor.name}</h1>
        <p className="text-[12px] text-ink-70 mt-1">
          The payment methods this vendor accepts. We use
          these details when paying them — ACH routing for
          bank transfers, last-4 of their card, or the
          check #.
        </p>
        <p className="text-[11px] text-ink-50 mt-2 font-mono">
          Note: we store the last 4 digits only. The full
          account / card number stays in the vendor&apos;s
          own records.
        </p>
      </div>

      <VendorPaymentMethodsEditor
        workspaceSlug={workspace.slug}
        vendor={{
          id: vendor.id,
          name: vendor.name,
          methods: vendor.paymentMethods.map((m) => ({
            id: m.id,
            methodType: m.methodType,
            isDefault: m.isDefault,
            nickname: m.nickname,
            last4: m.last4,
            achBankName: m.achBankName,
            achRoutingLast4: m.achRoutingLast4,
            achAccountLast4: m.achAccountLast4,
            cardBrand: m.cardBrand,
            isActive: m.isActive,
          })),
        }}
      />

      <div className="mt-6 text-[11px] text-ink-50 font-mono">
        Workspace-wide payment settings (default invoice
        email, ACH instructions, check mailing address) live
        at{' '}
        <Link
          href={`/w/${workspace.slug}/settings/payments`}
          className="text-orange-d hover:underline"
        >
          Settings → Payments
        </Link>
        .
      </div>
    </div>
  );
}
