'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const folderColors = [
  'orange',
  'ink',
  'ink-30',
  'success',
  'warning',
  'error',
  'cream-2',
  'line',
] as const;

export type FolderColor = (typeof folderColors)[number];

const createFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  description: z.string().max(200).optional(),
  color: z.enum(folderColors).default('orange'),
});

export type CreateFolderState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; id?: string }
  | undefined;

export async function createPhotoFolderAction(
  workspaceSlug: string,
  projectId: string,
  _prev: CreateFolderState,
  formData: FormData,
): Promise<CreateFolderState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD', 'MEMBER']);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return { error: 'Project not found' };

  const parsed = createFolderSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    color: formData.get('color') || 'orange',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Get next sort order
  const max = await prisma.projectPhotoFolder.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  const nextSort = (max._max.sortOrder ?? -1) + 1;

  try {
    const folder = await prisma.projectPhotoFolder.create({
      data: {
        projectId,
        workspaceId: workspace.id,
        name: parsed.data.name,
        description: parsed.data.description,
        color: parsed.data.color,
        sortOrder: nextSort,
      },
    });
    revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/photos`);
    return { ok: true, id: folder.id };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { error: 'A folder with that name already exists', fieldErrors: { name: 'Already exists' } };
    }
    throw e;
  }
}

export async function updatePhotoFolderAction(
  workspaceSlug: string,
  projectId: string,
  folderId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD', 'MEMBER']);

  const data: { name?: string; description?: string; color?: FolderColor } = {};
  const name = formData.get('name');
  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  const description = formData.get('description');
  if (typeof description === 'string') data.description = description;
  const color = formData.get('color');
  if (typeof color === 'string' && (folderColors as readonly string[]).includes(color)) {
    data.color = color as FolderColor;
  }

  try {
    await prisma.projectPhotoFolder.updateMany({
      where: { id: folderId, projectId, workspaceId: workspace.id },
      data,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { ok: false, error: 'A folder with that name already exists' };
    }
    return { ok: false, error: 'Update failed' };
  }
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/photos`);
  return { ok: true };
}

export async function deletePhotoFolderAction(
  workspaceSlug: string,
  projectId: string,
  folderId: string,
): Promise<{ ok: boolean; error?: string; movedCount?: number }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  // Photos in this folder will have their folderId set to null (onDelete: SetNull)
  const result = await prisma.projectPhotoFolder.deleteMany({
    where: { id: folderId, projectId, workspaceId: workspace.id },
  });
  if (result.count === 0) return { ok: false, error: 'Folder not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/photos`);
  return { ok: true };
}
