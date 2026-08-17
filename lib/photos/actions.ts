'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { put } from '@vercel/blob';
import { PhotoPhase } from '@prisma/client';
import { logActivity } from '@/lib/activity/log';

const uploadSchema = z.object({
  projectId: z.string().min(1),
  room: z.string().max(80).optional().nullable(),
  area: z.string().max(80).optional().nullable(),
  phase: z.nativeEnum(PhotoPhase).default(PhotoPhase.ROUGH_IN),
  caption: z.string().max(500).optional().nullable(),
  takenAt: z.coerce.date().optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export type UploadPhotoState =
  | { error?: string; ok?: boolean; id?: string; url?: string }
  | undefined;

const MAX_PHOTO_SIZE = 50 * 1024 * 1024; // 50 MB for camera shots

/**
 * Upload a project photo. Supports categorization (room/area/phase),
 * optional GPS, and an optional caption. Stored in Vercel Blob and
 * indexed in the ProjectPhoto table for filtering.
 */
export async function uploadProjectPhotoAction(
  workspaceSlug: string,
  _prev: UploadPhotoState,
  formData: FormData,
): Promise<UploadPhotoState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return { error: 'Workspace not found' };
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please pick a photo' };
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { error: 'Photo too large (max 50 MB)' };
  }
  if (!file.type.startsWith('image/')) {
    return { error: 'File must be an image' };
  }

  const parsed = uploadSchema.safeParse({
    projectId: formData.get('projectId'),
    room: formData.get('room') || undefined,
    area: formData.get('area') || undefined,
    phase: formData.get('phase') || undefined,
    caption: formData.get('caption') || undefined,
    takenAt: formData.get('takenAt') || undefined,
    latitude: formData.get('latitude') || undefined,
    longitude: formData.get('longitude') || undefined,
  });
  if (!parsed.success) {
    return { error: 'Invalid metadata: ' + parsed.error.issues[0]?.message };
  }

  // Verify the project belongs to this workspace
  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project || project.workspaceId !== workspace.id) {
    return { error: 'Project not found' };
  }

  // Upload to Vercel Blob
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = await put(
    `${workspace.id}/projects/${parsed.data.projectId}/${Date.now()}-${safeName}`,
    file,
    { access: 'public' },
  );

  const record = await prisma.projectPhoto.create({
    data: {
      workspaceId: workspace.id,
      projectId: parsed.data.projectId,
      uploaderId: userId,
      url: blob.url,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      room: parsed.data.room || null,
      area: parsed.data.area || null,
      phase: parsed.data.phase,
      caption: parsed.data.caption || null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      takenAt: parsed.data.takenAt ?? null,
    },
    select: { id: true, url: true },
  });

  try {
    await logActivity({
      workspaceId: workspace.id,
      actorId: userId,
      action: 'created',
      entityType: 'project',
      entityId: parsed.data.projectId,
      entityName: project.name,
      details: `Uploaded a ${parsed.data.phase === 'ROUGH_IN' ? 'rough-in' : 'final'} photo${parsed.data.room ? ` (${parsed.data.room})` : ''}`,
    });
  } catch {
    // noop
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${parsed.data.projectId}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${parsed.data.projectId}/photos`);
  return { ok: true, id: record.id, url: record.url };
}

const updateSchema = z.object({
  photoId: z.string().min(1),
  room: z.string().max(80).nullable().optional(),
  area: z.string().max(80).nullable().optional(),
  phase: z.nativeEnum(PhotoPhase).optional(),
  caption: z.string().max(500).nullable().optional(),
});

export type UpdatePhotoState = { error?: string; ok?: boolean } | undefined;

/**
 * Update a photo's categorization (room/area/phase) and caption. Only
 * the uploader or an OWNER/ADMIN can edit.
 */
export async function updateProjectPhotoAction(
  workspaceSlug: string,
  _prev: UpdatePhotoState,
  formData: FormData,
): Promise<UpdatePhotoState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };

  const parsed = updateSchema.safeParse({
    photoId: formData.get('photoId'),
    room: formData.get('room') || null,
    area: formData.get('area') || null,
    phase: formData.get('phase') || undefined,
    caption: formData.get('caption') || null,
  });
  if (!parsed.success) return { error: 'Invalid input' };

  const photo = await prisma.projectPhoto.findUnique({
    where: { id: parsed.data.photoId },
    include: { project: { select: { workspaceId: true, id: true } } },
  });
  if (!photo) return { error: 'Photo not found' };

  // Authorization: uploader or workspace owner/admin
  const isOwner = photo.uploaderId === userId;
  if (!isOwner) {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: photo.workspaceId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return { error: 'You can only edit your own photos' };
    }
  }

  await prisma.projectPhoto.update({
    where: { id: parsed.data.photoId },
    data: {
      room: parsed.data.room,
      area: parsed.data.area,
      phase: parsed.data.phase,
      caption: parsed.data.caption,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${photo.project.id}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${photo.project.id}/photos`);
  return { ok: true };
}

export async function deleteProjectPhotoAction(
  workspaceSlug: string,
  photoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const photo = await prisma.projectPhoto.findUnique({
    where: { id: photoId },
    include: { project: { select: { workspaceId: true, id: true } } },
  });
  if (!photo) return { ok: false, error: 'Photo not found' };

  const isOwner = photo.uploaderId === userId;
  if (!isOwner) {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: photo.workspaceId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return { ok: false, error: 'You can only delete your own photos' };
    }
  }

  await prisma.projectPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/w/${workspaceSlug}/projects/${photo.projectId}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${photo.projectId}/photos`);
  return { ok: true };
}
