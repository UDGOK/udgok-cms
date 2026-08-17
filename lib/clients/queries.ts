import { prisma } from '@/lib/db/client';
import type { Prisma, ClientStatus, ClientType } from '@prisma/client';

export interface ListClientsFilters {
  search?: string;
  status?: ClientStatus;
  type?: ClientType;
}

export interface ListClientsOptions {
  skip?: number;
  take?: number;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  orderDir?: 'asc' | 'desc';
}

export async function listClients(
  workspaceId: string,
  filters: ListClientsFilters = {},
  options: ListClientsOptions = {},
) {
  const where: Prisma.ClientWhereInput = { workspaceId };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const orderByField = options.orderBy ?? 'name';
  const orderDir = options.orderDir ?? 'asc';
  const orderBy: Prisma.ClientOrderByWithRelationInput = { [orderByField]: orderDir };

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy,
      skip: options.skip ?? 0,
      take: options.take ?? 50,
      include: { _count: { select: { deals: true, projects: true } } },
    }),
    prisma.client.count({ where }),
  ]);

  return { items, total };
}

export async function getClient(workspaceId: string, id: string) {
  return prisma.client.findFirst({
    where: { id, workspaceId },
    include: {
      properties: { orderBy: { id: 'asc' } },
      deals: { orderBy: { createdAt: 'desc' } },
      projects: { orderBy: { createdAt: 'desc' } },
      tasks: { where: { status: { not: 'DONE' } }, take: 10 },
      notes: { orderBy: { createdAt: 'desc' }, take: 20, include: { author: true } },
      files: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
}
