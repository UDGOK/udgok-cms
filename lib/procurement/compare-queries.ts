/**
 * Quote-comparison queries.
 *
 * One row per MaterialListLine, one column per vendor. Each
 * cell shows the latest unit price (and a green ★ on the
 * cheapest), plus availability / lead time. The buyer then
 * picks "award" cells — one per line, optionally all from
 * the same vendor (single award) or mixed (mixed award).
 * Per spec §11: "Mixed award generates one PO per vendor —
 * build it that way from the start."
 */

import { prisma } from '@/lib/db/client';

export interface CompareRow {
  listLineId: string;
  position: number;
  description: string;
  uom: string;
  quantity: number;
  vendors: Array<{
    rfqId: string;
    vendorId: string;
    vendorName: string;
    quoteId: string | null;
    quoteRevision: number | null;
    unitPrice: number | null;
    lineTotal: number | null;
    available: boolean;
    leadTimeDays: number | null;
    isSubstitute: boolean;
  }>;
}

export interface CompareData {
  list: { id: string; name: string; status: string; neededBy: Date | null };
  rows: CompareRow[];
  vendors: Array<{ id: string; name: string }>;
}

export async function getCompareForList(
  workspaceId: string,
  listId: string,
): Promise<CompareData | null> {
  const list = await prisma.materialList.findFirst({
    where: { id: listId, workspaceId, deletedAt: null },
    include: {
      lines: { orderBy: { position: 'asc' } },
      rfqs: {
        where: { status: { in: ['RESPONDED', 'ACCEPTED'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { id: true, name: true } },
          quotes: {
            where: { status: 'SUBMITTED' },
            orderBy: { revision: 'desc' },
            take: 1,
            include: { lines: true },
          },
        },
      },
    },
  });
  if (!list) return null;

  // Build a row per line.
  const rows: CompareRow[] = list.lines.map((l) => ({
    listLineId: l.id,
    position: l.position,
    description: l.description,
    uom: l.uom,
    quantity: Number(l.quantity),
    vendors: list.rfqs.map((r) => {
      const q = r.quotes[0];
      const ql = q?.lines.find((ql) => ql.listLineId === l.id);
      return {
        rfqId: r.id,
        vendorId: r.vendor.id,
        vendorName: r.vendor.name,
        quoteId: q?.id ?? null,
        quoteRevision: q?.revision ?? null,
        unitPrice: ql?.unitPrice != null ? Number(ql.unitPrice) : null,
        lineTotal: ql?.lineTotal != null ? Number(ql.lineTotal) : null,
        available: ql?.available ?? false,
        leadTimeDays: ql?.leadTimeDays ?? null,
        isSubstitute: ql?.isSubstitute ?? false,
      };
    }),
  }));

  return {
    list: {
      id: list.id,
      name: list.name,
      status: list.status,
      neededBy: list.neededBy,
    },
    rows,
    vendors: list.rfqs.map((r) => ({ id: r.vendor.id, name: r.vendor.name })),
  };
}
