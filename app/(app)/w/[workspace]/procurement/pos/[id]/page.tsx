import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { getWorkspacePaymentSettings } from '@/lib/procurement/payment-settings';
import { PoDetailView } from './PoDetailView';
import { PoResponseSection } from './PoResponseSection';
import { PoPaymentSection } from './PoPaymentSection';

export const dynamic = 'force-dynamic';

export default async function PoDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const poRaw = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          paymentMethods: {
            where: { isActive: true },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          },
        },
      },
      lines: { orderBy: { position: 'asc' } },
      quote: { select: { id: true, revision: true, vendorReference: true } },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 50, // cap for the detail page; full history in dedicated audit view
      },
      vendorResponses: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
        include: { lines: { orderBy: { id: 'asc' } } },
      },
      invoices: {
        orderBy: { receivedAt: 'desc' },
      },
    },
  });
  if (!poRaw) notFound();
  // Cast workaround: Prisma's return type for `include` is
  // sometimes narrower than expected after a schema migration
  // (see agent memory "Prisma return type narrowing bug").
  const po = poRaw as unknown as NonNullable<typeof poRaw> & {
    paymentMethodChosen: string | null;
    paymentMethodDetail: string | null;
    vendorReference: string | null;
  };

  const settings = await getWorkspacePaymentSettings(workspace.id);
  const vendorResponse = po.vendorResponses[0] ?? null;

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Procurement
      </Link>
      <PoDetailView
        po={{
          id: po.id,
          number: po.number,
          status: po.status,
          vendor: { id: po.vendor.id, name: po.vendor.name },
          quote: po.quote,
          subtotal: Number(po.subtotal),
          freightAmount: Number(po.freightAmount),
          taxAmount: Number(po.taxAmount),
          total: Number(po.total),
          terms: po.terms,
          shipTo: po.shipTo,
          notes: po.notes,
          issuedAt: po.issuedAt ? po.issuedAt.toISOString() : null,
          issuedBy: po.issuedBy,
          createdAt: po.createdAt.toISOString(),
          paymentMethodChosen: po.paymentMethodChosen,
          paymentMethodDetail: po.paymentMethodDetail,
          vendorReference: po.vendorReference,
          deliveryName: po.deliveryName,
          deliveryAddress: po.deliveryAddress,
          deliveryContactName: po.deliveryContactName,
          deliveryContactPhone: po.deliveryContactPhone,
          deliveryContactEmail: po.deliveryContactEmail,
          lines: po.lines.map((l) => ({
            id: l.id,
            position: l.position,
            description: l.description,
            quantity: Number(l.quantity),
            uom: l.uom,
            vendorSku: l.vendorSku,
            unitPrice: l.unitPrice ? Number(l.unitPrice) : null,
            lineTotal: l.lineTotal ? Number(l.lineTotal) : null,
            isSubstitute: l.isSubstitute,
            substituteNote: l.substituteNote,
            notes: l.notes,
          })),
          events: po.events.map((e) => ({
            id: e.id,
            type: e.type,
            actor: e.actor,
            createdAt: e.createdAt.toISOString(),
            meta: e.meta,
          })),
        }}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
      />

      {vendorResponse ? (
        <PoResponseSection
          workspaceSlug={workspace.slug}
          poId={po.id}
          poStatus={po.status}
          poNumber={po.number}
          vendorName={po.vendor.name}
          poLines={po.lines.map((l) => ({
            id: l.id,
            position: l.position,
            description: l.description,
            quantity: Number(l.quantity),
            unitPrice: l.unitPrice ? Number(l.unitPrice) : null,
            lineTotal: l.lineTotal ? Number(l.lineTotal) : null,
          }))}
          response={{
            id: vendorResponse.id,
            responseType: vendorResponse.responseType,
            paymentMethod: vendorResponse.paymentMethod,
            paymentMethodDetail: vendorResponse.paymentMethodDetail,
            vendorReference: vendorResponse.vendorReference,
            notes: vendorResponse.notes,
            signedByName: vendorResponse.signedByName,
            signedByEmail: vendorResponse.signedByEmail,
            submittedAt: vendorResponse.submittedAt.toISOString(),
            lines: vendorResponse.lines.map((rl) => ({
              id: rl.id,
              poLineId: rl.poLineId,
              isConfirmed: rl.isConfirmed,
              confirmedQty: rl.confirmedQty ? Number(rl.confirmedQty) : null,
              confirmedPrice: rl.confirmedPrice ? Number(rl.confirmedPrice) : null,
              backorderQty: rl.backorderQty ? Number(rl.backorderQty) : null,
              shipDate: rl.shipDate ? rl.shipDate.toISOString() : null,
              substituteSku: rl.substituteSku,
              notes: rl.notes,
            })),
          }}
        />
      ) : null}

      {po.invoices.length > 0 ? (
        <PoPaymentSection
          workspaceSlug={workspace.slug}
          poId={po.id}
          poStatus={po.status}
          poNumber={po.number}
          vendorName={po.vendor.name}
          settings={settings}
          invoices={po.invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate.toISOString(),
            invoiceAmount: Number(inv.invoiceAmount),
            status: inv.status,
            submittedByEmail: inv.submittedByEmail,
            receivedAt: inv.receivedAt.toISOString(),
            approvedAt: inv.approvedAt ? inv.approvedAt.toISOString() : null,
            approvedById: inv.approvedById,
            disputedAt: inv.disputedAt ? inv.disputedAt.toISOString() : null,
            disputedReason: inv.disputedReason,
            paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
            paidMethod: inv.paidMethod,
            paidReference: inv.paidReference,
            paidById: inv.paidById,
            notes: inv.notes,
          }))}
        />
      ) : null}
    </div>
  );
}
