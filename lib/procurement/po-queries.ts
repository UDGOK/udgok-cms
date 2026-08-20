/**
 * PO list query for /procurement/pos.
 */

import { prisma } from '@/lib/db/client';

export interface PoListItem {
  id: string;
  number: string;
  status: string;
  vendor: { id: string; name: string };
  total: number;
  issuedAt: Date | null;
  createdAt: Date;
  lineCount: number;
  rfqNumber: string | null;
}

export async function listAllPos(workspaceId: string): Promise<PoListItem[]> {
  const rows = await prisma.purchaseOrder.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      vendor: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
      quote: { select: { rfq: { select: { number: true } } } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    number: p.number,
    status: p.status,
    vendor: p.vendor,
    total: Number(p.total),
    issuedAt: p.issuedAt,
    createdAt: p.createdAt,
    lineCount: p._count.lines,
    rfqNumber: p.quote?.rfq?.number ?? null,
  }));
}
