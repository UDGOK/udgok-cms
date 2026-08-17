import { prisma } from '@/lib/db/client';

export async function listClientNotes(clientId: string, take = 50) {
  return prisma.note.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function listDealNotes(dealId: string, take = 50) {
  return prisma.note.findMany({
    where: { dealId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function listProjectNotes(projectId: string, take = 50) {
  return prisma.note.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export type CreateNoteInput = {
  authorId: string;
  body: string;
  clientId?: string;
  dealId?: string;
  projectId?: string;
};

export async function createNote(data: CreateNoteInput) {
  return prisma.note.create({ data });
}
