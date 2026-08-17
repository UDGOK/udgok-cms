import { prisma } from '@/lib/db/client';
import { MessageEntityType } from '@prisma/client';

export interface MessageWithAuthor {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  threadId: string | null;
  authorId: string;
  author: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

/**
 * List all top-level messages (and their reply counts) for an entity.
 * Returns them in chronological order.
 */
export async function listMessagesForEntity(
  entityType: MessageEntityType,
  entityId: string,
  limit = 50,
): Promise<MessageWithAuthor[]> {
  const messages = await prisma.message.findMany({
    where: { entityType, entityId, threadId: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
  return messages;
}

/**
 * List replies for a given thread (root message).
 */
export async function listReplies(threadId: string): Promise<MessageWithAuthor[]> {
  return prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
}

/**
 * Counts of unread messages per entity for the given user.
 * Used for badge indicators on detail pages.
 */
export async function countUnreadMessages(
  workspaceId: string,
  userId: string,
): Promise<Record<string, number>> {
  // For now, "unread" is approximated as: messages not authored by the user
  // and created in the last 30 days. Future: add a MessageRead table for
  // proper read-tracking. This is good enough for badge display.
  const recent = await prisma.message.findMany({
    where: {
      workspaceId,
      authorId: { not: userId },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { entityType: true, entityId: true },
  });
  const counts: Record<string, number> = {};
  for (const m of recent) {
    const key = `${m.entityType}:${m.entityId}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
