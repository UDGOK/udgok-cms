import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { ListDetailView } from './ListDetailView';

export default async function MaterialListDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const list = await prisma.materialList.findFirst({
    where: { id: params.id, workspaceId: workspace.id, deletedAt: null },
    include: {
      lines: {
        orderBy: { position: 'asc' },
        include: {
          item: { select: { id: true, description: true, sku: true } },
        },
      },
      rfqs: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          vendor: { select: { id: true, name: true } },
          sentAt: true,
          respondedAt: true,
        },
      },
    },
  });
  if (!list) notFound();

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement/lists`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Material lists
      </Link>
      <ListDetailView
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        list={{
          id: list.id,
          name: list.name,
          status: list.status,
          neededBy: list.neededBy ? list.neededBy.toISOString() : null,
          deliverTo: list.deliverTo,
          notes: list.notes,
          createdAt: list.createdAt.toISOString(),
          updatedAt: list.updatedAt.toISOString(),
          lines: list.lines.map((l) => ({
            id: l.id,
            position: l.position,
            description: l.description,
            manufacturer: l.manufacturer,
            mfrPartNumber: l.mfrPartNumber,
            quantity: Number(l.quantity),
            uom: l.uom,
            notes: l.notes,
            item: l.item
              ? { id: l.item.id, description: l.item.description, sku: l.item.sku }
              : null,
          })),
          rfqs: list.rfqs.map((r) => ({
            id: r.id,
            number: r.number,
            status: r.status,
            vendor: r.vendor,
            sentAt: r.sentAt ? r.sentAt.toISOString() : null,
            respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
          })),
        }}
      />
    </div>
  );
}
