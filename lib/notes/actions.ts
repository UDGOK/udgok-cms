'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';

const noteSchema = z.object({
  body: z.string().min(1, 'Note cannot be empty').max(4000),
  clientId: z.string().optional(),
  dealId: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateNoteState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function createClientNoteAction(
  workspaceSlug: string,
  clientId: string,
  _prev: CreateNoteState,
  formData: FormData,
): Promise<CreateNoteState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const { prisma } = await import('@/lib/db/client');
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return { error: 'Workspace not found' };
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const parsed = noteSchema.safeParse({
    body: formData.get('body'),
    clientId,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.note.create({
    data: {
      authorId: userId,
      body: parsed.data.body,
      clientId,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/clients/${clientId}`);
  return { ok: true };
}

export async function createDealNoteAction(
  workspaceSlug: string,
  dealId: string,
  _prev: CreateNoteState,
  formData: FormData,
): Promise<CreateNoteState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return { error: 'Workspace not found' };
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const parsed = noteSchema.safeParse({
    body: formData.get('body'),
    dealId,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.note.create({
    data: {
      authorId: userId,
      body: parsed.data.body,
      dealId,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/deals/${dealId}`);
  return { ok: true };
}
