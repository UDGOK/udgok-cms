import { prisma } from '@/lib/db/client';
import { PhotoPhase } from '@prisma/client';

export interface ProjectPhotoListItem {
  id: string;
  url: string;
  filename: string;
  folderId: string | null;
  folderName: string | null;
  folderColor: string | null;
  room: string | null;
  area: string | null;
  phase: PhotoPhase;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  takenAt: Date | null;
  createdAt: Date;
  uploaderId: string;
  uploader: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

export interface ProjectPhotoFilters {
  phase?: PhotoPhase;
  room?: string;
  area?: string;
  uploaderId?: string;
  folderId?: string | null;
}

/**
 * List all photos for a project, with optional filters. Returns them
 * newest-first.
 */
export async function listProjectPhotos(
  projectId: string,
  filters: ProjectPhotoFilters = {},
): Promise<ProjectPhotoListItem[]> {
  const where: {
    projectId: string;
    phase?: PhotoPhase;
    room?: string;
    area?: string;
    uploaderId?: string;
    folderId?: string | null;
  } = { projectId };
  if (filters.phase) where.phase = filters.phase;
  if (filters.room) where.room = filters.room;
  if (filters.area) where.area = filters.area;
  if (filters.uploaderId) where.uploaderId = filters.uploaderId;
  if (filters.folderId !== undefined) {
    where.folderId = filters.folderId;
  }

  const rows = await prisma.projectPhoto.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      uploader: { select: { id: true, name: true, email: true, avatarUrl: true } },
      folder: { select: { id: true, name: true, color: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    filename: r.filename,
    folderId: r.folderId,
    folderName: r.folder?.name ?? null,
    folderColor: r.folder?.color ?? null,
    room: r.room,
    area: r.area,
    phase: r.phase,
    caption: r.caption,
    latitude: r.latitude,
    longitude: r.longitude,
    takenAt: r.takenAt,
    createdAt: r.createdAt,
    uploaderId: r.uploaderId,
    uploader: r.uploader,
  }));
}

/**
 * Get the distinct set of rooms/areas used in a project. Used to
 * populate the filter dropdowns.
 */
export async function getProjectPhotoFacets(projectId: string) {
  const photos = await prisma.projectPhoto.findMany({
    where: { projectId },
    select: { room: true, area: true, phase: true, folderId: true },
  });
  const rooms = new Set<string>();
  const areas = new Set<string>();
  for (const p of photos) {
    if (p.room) rooms.add(p.room);
    if (p.area) areas.add(p.area);
  }
  return {
    rooms: Array.from(rooms).sort(),
    areas: Array.from(areas).sort(),
    totalCount: photos.length,
    roughInCount: photos.filter((p) => p.phase === 'ROUGH_IN').length,
    finalCount: photos.filter((p) => p.phase === 'FINAL').length,
  };
}

/**
 * Count photos by phase for dashboard / project cards.
 */
export async function countProjectPhotosByPhase(projectId: string) {
  const grouped = await prisma.projectPhoto.groupBy({
    by: ['phase'],
    where: { projectId },
    _count: { _all: true },
  });
  const result: Record<PhotoPhase, number> = { ROUGH_IN: 0, FINAL: 0 };
  for (const g of grouped) result[g.phase] = g._count._all;
  return result;
}
