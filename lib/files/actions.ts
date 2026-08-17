'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';

const uploadSchema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  dealId: z.string().optional(),
  category: z.string().max(40).optional(),
});

export type UploadState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; id?: string }
  | undefined;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function uploadFileAction(
  workspaceSlug: string,
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return { error: 'Workspace not found' };
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please pick a file' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File too large (max 25 MB)' };
  }

  const parsed = uploadSchema.safeParse({
    clientId: formData.get('clientId') || undefined,
    projectId: formData.get('projectId') || undefined,
    dealId: formData.get('dealId') || undefined,
    category: formData.get('category') || undefined,
  });
  if (!parsed.success) {
    return { error: 'Invalid metadata' };
  }

  // Upload to Vercel Blob
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = await put(
    `${workspace.id}/${Date.now()}-${safeName}`,
    file,
    { access: 'public' },
  );

  const record = await prisma.file.create({
    data: {
      workspaceId: workspace.id,
      uploaderId: userId,
      url: blob.url,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      kind: 'DOCUMENT',
      category: parsed.data.category,
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      dealId: parsed.data.dealId,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/files`);
  return { ok: true, id: record.id };
}
