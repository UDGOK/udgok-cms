/**
 * Item catalog queries — workspace-scoped reads.
 *
 * Items are optional. MaterialList lines can be free-text
 * (description + qty + uom) without any item record. Items
 * exist for things the company buys repeatedly and wants
 * price history keyed on (the "moat").
 */

import { prisma } from '@/lib/db/client';

export interface ItemListItem {
  id: string;
  sku: string | null;
  description: string;
  uom: string;
  category: string | null;
  manufacturer: string | null;
  mfrPartNumber: string | null;
  defaultVendorName: string | null;
  active: boolean;
  priceCount: number;
  lastQuotedAt: Date | null;
  createdAt: Date;
}

export async function listItems(workspaceId: string, q?: string): Promise<ItemListItem[]> {
  const rows = await prisma.item.findMany({
    where: {
      workspaceId,
      active: true,
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { mfrPartNumber: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { description: 'asc' },
    include: {
      _count: { select: { prices: true } },
      prices: { orderBy: { observedAt: 'desc' }, take: 1, select: { observedAt: true } },
      defaultVendor: { select: { name: true } },
    },
  });
  return rows.map((i) => ({
    id: i.id,
    sku: i.sku,
    description: i.description,
    uom: i.uom,
    category: i.category,
    manufacturer: i.manufacturer,
    mfrPartNumber: i.mfrPartNumber,
    defaultVendorName: i.defaultVendor?.name ?? null,
    active: i.active,
    priceCount: i._count.prices,
    lastQuotedAt: i.prices[0]?.observedAt ?? null,
    createdAt: i.createdAt,
  }));
}
