/**
 * Material list queries — workspace-scoped reads.
 *
 * A "material list" is the cart: a named bundle of line
 * items the team wants to buy. One MaterialList can spawn
 * many RFQs (one per vendor) so we can compare bids.
 */

import { prisma } from '@/lib/db/client';

export interface MaterialListSummary {
  id: string;
  name: string;
  status: string;
  lineCount: number;
  rfqCount: number;
  neededBy: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export async function listMaterialLists(workspaceId: string): Promise<MaterialListSummary[]> {
  const rows = await prisma.materialList.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { lines: true, rfqs: true } },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    lineCount: l._count.lines,
    rfqCount: l._count.rfqs,
    neededBy: l.neededBy,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    createdBy: l.createdBy,
  }));
}
