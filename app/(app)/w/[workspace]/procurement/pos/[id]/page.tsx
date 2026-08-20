import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { PoDetailView } from './PoDetailView';

export const dynamic = 'force-dynamic';

export default async function PoDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { position: 'asc' } },
      quote: { select: { id: true, revision: true, vendorReference: true } },
    },
  });
  if (!po) notFound();

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
          vendor: po.vendor,
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
        }}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
      />
    </div>
  );
}
