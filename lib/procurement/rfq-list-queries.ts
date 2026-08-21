/**
 * All-RFQs list query for the /procurement/rfqs page.
 */

import { prisma } from '@/lib/db/client';

export interface RfqListItem {
  id: string;
  number: string;
  status: string;
  vendor: { id: string; name: string };
  listId: string;
  listName: string;
  sentAt: Date | null;
  respondedAt: Date | null;
  expiresAt: Date;
  firstViewedAt: Date | null;
  total: number | null;
  hasPo: boolean;
}

export async function listAllRfqs(workspaceId: string): Promise<RfqListItem[]> {
  const rows = await prisma.rfq.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      vendor: { select: { id: true, name: true } },
      list: { select: { id: true, name: true } },
      quotes: {
        where: { status: 'SUBMITTED' },
        orderBy: { revision: 'desc' },
        take: 1,
        select: { total: true, po: { select: { id: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    vendor: r.vendor,
    listId: r.listId,
    listName: r.list.name,
    sentAt: r.sentAt,
    respondedAt: r.respondedAt,
    expiresAt: r.expiresAt,
    firstViewedAt: r.firstViewedAt,
    total: r.quotes[0]?.total ? Number(r.quotes[0].total) : null,
    hasPo: !!r.quotes[0]?.po,
  }));
}
