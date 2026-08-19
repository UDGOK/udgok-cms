'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { put, del as blobDel } from '@vercel/blob';
import { PhotoPhase } from '@prisma/client';
import { logActivity } from '@/lib/activity/log';

const uploadSchema = z.object({
  projectId: z.string().min(1),
  folderId: z.string().optional().nullable(),
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
    folderId: formData.get('folderId') || undefined,
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

  // Verify the folder, if provided, belongs to this project
  if (parsed.data.folderId) {
    const folder = await prisma.projectPhotoFolder.findUnique({
      where: { id: parsed.data.folderId },
    });
    if (!folder || folder.projectId !== parsed.data.projectId) {
      return { error: 'Invalid folder' };
    }
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
      folderId: parsed.data.folderId || null,
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
  folderId: z.string().nullable().optional(),
  room: z.string().max(80).nullable().optional(),
  area: z.string().max(80).nullable().optional(),
  phase: z.nativeEnum(PhotoPhase).optional(),
  caption: z.string().max(500).nullable().optional(),
});

export type UpdatePhotoState =
  | { ok: true; photo: { id: string; caption: string | null; url: string; filename: string } }
  | { error: string }
  | undefined;

/**
 * Update a photo's metadata (caption, room, area, phase, folder).
 * Optionally replace the image file with a new upload — when a
 * file is provided, the old blob is deleted from Vercel Blob so
 * we don't leak storage. Returns the updated photo row so the
 * client can update its local state without a router.refresh().
 *
 * Authorization: the photo's uploader OR workspace OWNER/ADMIN.
 * FIELD members can only edit photos they uploaded.
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
    folderId: formData.get('folderId') || null,
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

  // Verify folder if provided
  if (parsed.data.folderId) {
    const folder = await prisma.projectPhotoFolder.findUnique({
      where: { id: parsed.data.folderId },
    });
    if (!folder || folder.projectId !== photo.project.id) {
      return { error: 'Invalid folder' };
    }
  }

  // Optional image replacement. If a new file is provided,
  // upload it to Vercel Blob, swap the URL on the row, and
  // delete the old blob. We only update fields the caller
  // explicitly sent — z's `.optional().nullable()` leaves
  // them undefined, and the update object omits them in
  // that case.
  const newFile = formData.get('file');
  let newUrl: string | undefined;
  let newFilename: string | undefined;
  let newSize: number | undefined;
  let newMimeType: string | undefined;
  if (newFile instanceof File && newFile.size > 0) {
    if (newFile.size > 50 * 1024 * 1024) {
      return { error: 'Replacement photo too large (max 50 MB)' };
    }
    if (!newFile.type.startsWith('image/')) {
      return { error: 'Replacement file must be an image' };
    }
    const blob = await put(
      `projects/${photo.project.id}/photos/${Date.now()}-${newFile.name}`,
      newFile,
      { access: 'public', addRandomSuffix: true },
    );
    newUrl = blob.url;
    newFilename = newFile.name;
    newSize = newFile.size;
    newMimeType = newFile.type;
  }

  // Build the update object. Only set fields that were actually
  // sent. z's `optional().nullable()` can't distinguish "not sent"
  // vs "explicitly null" — we use presence in formData instead.
  const data: Record<string, unknown> = {};
  if (formData.has('caption')) data.caption = parsed.data.caption || null;
  if (formData.has('room')) data.room = parsed.data.room || null;
  if (formData.has('area')) data.area = parsed.data.area || null;
  if (formData.has('phase') && parsed.data.phase) data.phase = parsed.data.phase;
  if (formData.has('folderId')) data.folderId = parsed.data.folderId || null;
  if (newUrl) {
    data.url = newUrl;
    data.filename = newFilename!;
    data.size = newSize!;
    data.mimeType = newMimeType!;
  }

  const updated = await prisma.projectPhoto.update({
    where: { id: parsed.data.photoId },
    data,
    select: { id: true, caption: true, url: true, filename: true },
  });

  // Delete the old blob if we replaced the image. Best-effort —
  // if this fails, the old file stays in storage until the
  // next orphan-cleanup job runs.
  if (newUrl && photo.url && newUrl !== photo.url) {
    try {
      await blobDel(photo.url);
    } catch {
      // swallow
    }
  }

  await logActivity({
    workspaceId: photo.workspaceId,
    actorId: userId,
    action: 'updated',
    entityType: 'project',
    entityId: photo.project.id,
    entityName: 'photo',
    details: newUrl
      ? `Replaced image for "${updated.caption || updated.filename}"`
      : `Edited photo "${updated.caption || updated.filename}"`,
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${photo.project.id}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${photo.project.id}/photos`);
  return { ok: true, photo: updated };
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
  // Best-effort blob cleanup. If this fails (network blip,
  // already-deleted, etc.) we still consider the delete
  // successful — the row is gone from our DB, and orphan
  // blobs are picked up by a periodic sweep job.
  if (photo.url) {
    try {
      await blobDel(photo.url);
    } catch {
      // intentionally swallow — see comment above
    }
  }
  revalidatePath(`/w/${workspaceSlug}/projects/${photo.projectId}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${photo.projectId}/photos`);
  return { ok: true };
}

