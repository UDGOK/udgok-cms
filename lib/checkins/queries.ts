import { prisma } from '@/lib/db/client';

/**
 * Query helpers for the site check-in feature.
 *
 * The list-shape queries return lean objects (no joined
 * sub-relations) so the admin pages render fast. The
 * "who" name on each row is pre-resolved in a single
 * batched lookup so the page doesn't do N+1.
 */

export interface OpenCheckInRow {
  id: string;
  projectId: string;
  projectName: string;
  siteCheckInCodeId: string;
  codeLabel: string;
  who: { kind: 'user' | 'sub'; id: string; name: string };
  checkedInAt: Date;
  note: string | null;
  // GPS verification fields. lat/lng come from the
  // visitor's phone at check-in. distanceMeters is
  // computed server-side from the code's bound lat/lng
  // to the visitor's lat/lng. ok is true when the
  // distance is within the code's geofence.
  checkInLat: number | null;
  checkInLng: number | null;
  geofenceDistanceMeters: number | null;
  geofenceOk: boolean | null;
}

export interface HistoryCheckInRow extends OpenCheckInRow {
  checkedOutAt: Date;
  durationMs: number;
  checkOutLat: number | null;
  checkOutLng: number | null;
}

export interface CheckInCodeRow {
  id: string;
  projectId: string;
  label: string;
  token: string;
  isActive: boolean;
  createdAt: Date;
  createdByName: string | null;
  // GPS binding (v2 — Aug 2026). Null when the code was
  // created without GPS capture (legacy "no GPS" flow).
  lat: number | null;
  lng: number | null;
  geofenceMeters: number | null;
  requireWithinGeofence: boolean;
  addressSnapshot: string | null;
}

/**
 * All open check-ins across a workspace, newest first.
 * Used by the admin "who is on site now" panel.
 */
export async function listOpenCheckInsForWorkspace(
  workspaceId: string,
): Promise<OpenCheckInRow[]> {
  const rows = await prisma.checkInEvent.findMany({
    where: { workspaceId, checkedOutAt: null },
    orderBy: { checkedInAt: 'desc' },
    include: {
      project: { select: { id: true, name: true } },
      siteCheckInCode: { select: { id: true, label: true } },
      user: { select: { id: true, name: true, email: true } },
      subcontractor: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.project.name,
    siteCheckInCodeId: r.siteCheckInCodeId,
    codeLabel: r.siteCheckInCode.label,
    who: r.userId && r.user
      ? { kind: 'user', id: r.user.id, name: r.user.name ?? r.user.email ?? 'Unknown user' }
      : r.subcontractorId && r.subcontractor
        ? { kind: 'sub', id: r.subcontractor.id, name: r.subcontractor.name }
        : { kind: 'user', id: 'unknown', name: 'Unknown' },
    checkedInAt: r.checkedInAt,
    note: r.note,
    checkInLat: r.checkInLat,
    checkInLng: r.checkInLng,
    geofenceDistanceMeters: r.geofenceDistanceMeters,
    geofenceOk: r.geofenceOk,
  }));
}

/**
 * Open check-ins for one project only.
 */
export async function listOpenCheckInsForProject(
  projectId: string,
): Promise<OpenCheckInRow[]> {
  const rows = await prisma.checkInEvent.findMany({
    where: { projectId, checkedOutAt: null },
    orderBy: { checkedInAt: 'desc' },
    include: {
      project: { select: { id: true, name: true } },
      siteCheckInCode: { select: { id: true, label: true } },
      user: { select: { id: true, name: true, email: true } },
      subcontractor: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.project.name,
    siteCheckInCodeId: r.siteCheckInCodeId,
    codeLabel: r.siteCheckInCode.label,
    who: r.userId && r.user
      ? { kind: 'user', id: r.user.id, name: r.user.name ?? r.user.email ?? 'Unknown user' }
      : r.subcontractorId && r.subcontractor
        ? { kind: 'sub', id: r.subcontractor.id, name: r.subcontractor.name }
        : { kind: 'user', id: 'unknown', name: 'Unknown' },
    checkedInAt: r.checkedInAt,
    note: r.note,
    checkInLat: r.checkInLat,
    checkInLng: r.checkInLng,
    geofenceDistanceMeters: r.geofenceDistanceMeters,
    geofenceOk: r.geofenceOk,
  }));
}

/**
 * Recently closed check-ins for one project. Most recent
 * first. `limit` defaults to 50 — enough for a per-project
 * detail page, small enough to render in a tight table.
 */
export async function listRecentCheckInsForProject(
  projectId: string,
  limit = 50,
): Promise<HistoryCheckInRow[]> {
  const rows = await prisma.checkInEvent.findMany({
    where: { projectId, checkedOutAt: { not: null } },
    orderBy: { checkedOutAt: 'desc' },
    take: limit,
    include: {
      project: { select: { id: true, name: true } },
      siteCheckInCode: { select: { id: true, label: true } },
      user: { select: { id: true, name: true, email: true } },
      subcontractor: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.project.name,
    siteCheckInCodeId: r.siteCheckInCodeId,
    codeLabel: r.siteCheckInCode.label,
    who: r.userId && r.user
      ? { kind: 'user', id: r.user.id, name: r.user.name ?? r.user.email ?? 'Unknown user' }
      : r.subcontractorId && r.subcontractor
        ? { kind: 'sub', id: r.subcontractor.id, name: r.subcontractor.name }
        : { kind: 'user', id: 'unknown', name: 'Unknown' },
    checkedInAt: r.checkedInAt,
    note: r.note,
    checkInLat: r.checkInLat,
    checkInLng: r.checkInLng,
    geofenceDistanceMeters: r.geofenceDistanceMeters,
    geofenceOk: r.geofenceOk,
    checkedOutAt: r.checkedOutAt as Date,
    durationMs: r.checkedOutAt
      ? r.checkedOutAt.getTime() - r.checkedInAt.getTime()
      : 0,
    checkOutLat: r.checkOutLat,
    checkOutLng: r.checkOutLng,
  }));
}

/**
 * Recently closed check-ins for the entire workspace.
 * Used by the admin dashboard "Recent activity" panel.
 */
export async function listRecentCheckInsForWorkspace(
  workspaceId: string,
  limit = 20,
): Promise<HistoryCheckInRow[]> {
  const rows = await prisma.checkInEvent.findMany({
    where: { workspaceId, checkedOutAt: { not: null } },
    orderBy: { checkedOutAt: 'desc' },
    take: limit,
    include: {
      project: { select: { id: true, name: true } },
      siteCheckInCode: { select: { id: true, label: true } },
      user: { select: { id: true, name: true, email: true } },
      subcontractor: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.project.name,
    siteCheckInCodeId: r.siteCheckInCodeId,
    codeLabel: r.siteCheckInCode.label,
    who: r.userId && r.user
      ? { kind: 'user', id: r.user.id, name: r.user.name ?? r.user.email ?? 'Unknown user' }
      : r.subcontractorId && r.subcontractor
        ? { kind: 'sub', id: r.subcontractor.id, name: r.subcontractor.name }
        : { kind: 'user', id: 'unknown', name: 'Unknown' },
    checkedInAt: r.checkedInAt,
    note: r.note,
    checkInLat: r.checkInLat,
    checkInLng: r.checkInLng,
    geofenceDistanceMeters: r.geofenceDistanceMeters,
    geofenceOk: r.geofenceOk,
    checkedOutAt: r.checkedOutAt as Date,
    durationMs: r.checkedOutAt
      ? r.checkedOutAt.getTime() - r.checkedInAt.getTime()
      : 0,
    checkOutLat: r.checkOutLat,
    checkOutLng: r.checkOutLng,
  }));
}

/**
 * All check-in codes for one project, ordered most recent
 * first. Inactive codes are still returned (the admin
 * may want to see them) but the per-code UI distinguishes
 * them visually.
 */
export async function listCheckInCodesForProject(
  projectId: string,
): Promise<CheckInCodeRow[]> {
  const rows = await prisma.siteCheckInCode.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    label: r.label,
    token: r.token,
    isActive: r.isActive,
    createdAt: r.createdAt,
    createdByName: r.createdBy.name ?? r.createdBy.email ?? null,
    lat: r.lat,
    lng: r.lng,
    geofenceMeters: r.geofenceMeters,
    requireWithinGeofence: r.requireWithinGeofence,
    addressSnapshot: r.addressSnapshot,
  }));
}

/**
 * Look up a code by its public token. Returns null if the
 * token doesn't exist. Used by the public /c/[token] page
 * to resolve the project + label before rendering.
 *
 * The workspace and project joins are needed for the page
 * to render project name and address, so we include them.
 */
export async function findCheckInCodeByToken(token: string) {
  return prisma.siteCheckInCode.findUnique({
    where: { token },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          workspaceId: true,
          workspace: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

/**
 * Find an open check-in for the given "who" + project. Used
 * by the toggle action to decide whether to check in or
 * check out. The "who" is a tuple of (userId, subcontractorId)
 * where exactly one is non-null.
 */
export async function findOpenCheckIn(
  projectId: string,
  who: { userId?: string | null; subcontractorId?: string | null },
) {
  if (who.userId) {
    return prisma.checkInEvent.findFirst({
      where: { projectId, userId: who.userId, checkedOutAt: null },
    });
  }
  if (who.subcontractorId) {
    return prisma.checkInEvent.findFirst({
      where: { projectId, subcontractorId: who.subcontractorId, checkedOutAt: null },
    });
  }
  return null;
}
