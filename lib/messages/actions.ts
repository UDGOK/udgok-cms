'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { MessageEntityType } from '@prisma/client';
import { logActivity } from '@/lib/activity/log';

const postSchema = z.object({
  workspaceSlug: z.string().min(1),
  entityType: z.nativeEnum(MessageEntityType),
  entityId: z.string().min(1),
  body: z.string().min(1).max(5000),
  threadId: z.string().optional(),
});

export type PostMessageState = { error?: string; ok?: boolean; id?: string } | undefined;

export async function postMessageAction(
  _prev: PostMessageState,
  formData: FormData,
): Promise<PostMessageState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };

  const parsed = postSchema.safeParse({
    workspaceSlug: formData.get('workspaceSlug'),
    entityType: formData.get('entityType'),
    entityId: formData.get('entityId'),
    body: formData.get('body'),
    threadId: formData.get('threadId') || undefined,
  });
  if (!parsed.success) {
    return { error: 'Message cannot be empty' };
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: parsed.data.workspaceSlug } });
  if (!workspace) return { error: 'Workspace not found' };
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD', 'MEMBER']);

  // If a threadId is provided, verify it exists in the same entity
  if (parsed.data.threadId) {
    const root = await prisma.message.findUnique({ where: { id: parsed.data.threadId } });
    if (!root || root.workspaceId !== workspace.id || root.entityType !== parsed.data.entityType || root.entityId !== parsed.data.entityId) {
      return { error: 'Thread not found' };
    }
  }

  const message = await prisma.message.create({
    data: {
      workspaceId: workspace.id,
      authorId: userId,
      body: parsed.data.body,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      threadId: parsed.data.threadId ?? null,
    },
    select: { id: true },
  });

  // Best-effort activity log (don't fail the post if logging fails)
  try {
    await logActivity({
      workspaceId: workspace.id,
      actorId: userId,
      action: 'created',
      entityType: 'message',
      entityId: message.id,
      entityName: parsed.data.body.slice(0, 60),
      details: parsed.data.threadId ? 'Replied to a thread' : 'Posted a message',
    });
  } catch {
    // noop
  }

  revalidatePath(`/w/${parsed.data.workspaceSlug}`);
  return { ok: true, id: message.id };
}

export async function deleteMessageAction(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) return { ok: false, error: 'Message not found' };

  // Author can always delete their own. OWNER/ADMIN can delete anything.
  const isAuthor = message.authorId === userId;
  if (!isAuthor) {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: message.workspaceId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return { ok: false, error: 'You can only delete your own messages' };
    }
  }

  await prisma.message.delete({ where: { id: messageId } });
  return { ok: true };
}

export async function editMessageAction(
  messageId: string,
  newBody: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const trimmed = newBody.trim();
  if (!trimmed) return { ok: false, error: 'Message cannot be empty' };
  if (trimmed.length > 5000) return { ok: false, error: 'Message too long' };

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) return { ok: false, error: 'Message not found' };
  if (message.authorId !== userId) {
    return { ok: false, error: 'You can only edit your own messages' };
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { body: trimmed, editedAt: new Date() },
  });
  return { ok: true };
}
