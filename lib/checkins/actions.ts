'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { generateCheckInToken } from './qr-token';
import { findOpenCheckIn } from './queries';
import { emitNotification } from '@/lib/notifications/actions';
import { haversineMeters } from '@/lib/geo/distance';

// =====================================================================
// ADMIN: generate / deactivate a SiteCheckInCode
// =====================================================================

export type GenerateCodeState =
  | { ok: true; id: string; token: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Helper: turn empty / missing form fields into undefined
// BEFORE z.coerce runs. Without this, an empty input
// gets coerced to 0 (which the user probably didn't
// mean — they meant "no value"). With it, an empty
// input stays undefined, and the schema is just
// `z.coerce.number().optional()` with no `.or(z.literal(''))`
// jank.
const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);

const generateCodeSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  label: z.string().min(1, 'Label is required').max(80, 'Label too long'),
  // Geofence binding. All optional so legacy "no GPS" flow
  // still works (you can generate a code without pinning
  // it to a location). Empty-string inputs normalize to
  // undefined via emptyToUndefined.
  lat: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
  lng: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
  geofenceMeters: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(5000).optional(),
  ),
  requireWithinGeofence: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
    .optional(),
});

/**
 * Create a new SiteCheckInCode for a project. Generates a
 * 24-byte random token, persists the row, and returns the
 * id + token so the admin can immediately see the QR.
 *
 * The token is the credential: anyone with the sticker can
 * scan it. We treat it as a high-entropy secret but do
 * not hash it — the URL needs the plaintext to resolve.
 * Treat the printed sticker like a physical key.
 *
 * Authorization: OWNER, ADMIN, PM, or FIELD. Estimators and
 * plain members don't create codes.
 */
export async function generateCheckInCodeAction(
  workspaceSlug: string,
  _prev: GenerateCodeState | undefined,
  formData: FormData,
): Promise<GenerateCodeState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD']);

  const parsed = generateCodeSchema.safeParse({
    projectId: formData.get('projectId'),
    label: (formData.get('label') as string | null)?.trim(),
    lat: formData.get('lat') || undefined,
    lng: formData.get('lng') || undefined,
    geofenceMeters: formData.get('geofenceMeters') || undefined,
    requireWithinGeofence: formData.get('requireWithinGeofence') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // If they provided lat OR lng, require both. We don't
  // accept a half-pinned code.
  const hasLat = parsed.data.lat != null;
  const hasLng = parsed.data.lng != null;
  if (hasLat !== hasLng) {
    return {
      ok: false,
      error: 'Both latitude and longitude must be set (or both blank)',
      fieldErrors: { lat: 'Required when longitude is set', lng: 'Required when longitude is set' },
    };
  }

  // Verify the project belongs to this workspace (defense
  // against the user passing a project id from a different
  // workspace via crafted form data).
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, workspaceId: workspace.id },
    select: { id: true, address: true, city: true, state: true, zip: true },
  });
  if (!project) {
    return { ok: false, error: 'Project not found in this workspace' };
  }

  // Build the address snapshot. This is the project's
  // address at the moment of code generation so a future
  // admin (who might be at the office) can find the
  // sticker location without having to re-geocode.
  const addressParts = [project.address, project.city, project.state, project.zip]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  const addressSnapshot = addressParts.join(', ') || null;

  // Default radius: 150m. Admin can override per code.
  const geofenceMeters = parsed.data.geofenceMeters ?? 150;
  const requireWithinGeofence =
    parsed.data.requireWithinGeofence === 'on' ||
    parsed.data.requireWithinGeofence === 'true';

  // The token has a @unique constraint at the DB level. The
  // chance of a collision is 1 in 2^192 — vanishingly small
  // — but we still catch the duplicate-key error so a rare
  // retry can succeed.
  let token: string;
  let id: string;
  for (let attempt = 0; attempt < 3; attempt++) {
    token = generateCheckInToken();
    try {
      const created = await prisma.siteCheckInCode.create({
        data: {
          workspaceId: workspace.id,
          projectId: project.id,
          label: parsed.data.label,
          token,
          createdById: userId,
          isActive: true,
          // Geofence binding. If lat/lng are missing, we
          // leave the columns null — the code still works
          // for the legacy "no GPS" flow.
          lat: hasLat && parsed.data.lat != null ? parsed.data.lat : null,
          lng: hasLng && parsed.data.lng != null ? parsed.data.lng : null,
          geofenceMeters,
          requireWithinGeofence,
          addressSnapshot,
        },
        select: { id: true, token: true },
      });
      id = created.id;
      token = created.token;
      break;
    } catch (err: unknown) {
      // P2002 is Prisma's unique-constraint error. Only the
      // token collision is a retryable case; a project+label
      // collision is fine and we should fall through to the
      // error below. We don't have a unique on label per
      // project today, so any P2002 is a token collision.
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002' &&
        attempt < 2
      ) {
        continue;
      }
      throw err;
    }
  }

  // Activity log: so the audit trail shows that this admin
  // minted a new check-in sticker. The Activity model is the
  // universal "who did what" log used elsewhere in the app.
  await prisma.activityLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: userId,
      action: 'created',
      entityType: 'checkin_code',
      entityId: id!,
      entityName: parsed.data.label,
      details: `Generated site check-in code "${parsed.data.label}"`,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/checkin`);
  revalidatePath(`/w/${workspaceSlug}/checkin/${project.id}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${project.id}/checkins`);

  return { ok: true, id: id!, token: token! };
}

/**
 * Soft-disable a code. Doesn't delete the row so existing
 * CheckInEvent rows that reference it still resolve.
 * Admins can re-enable a code by calling this with
 * isActive=true, or by creating a new one.
 */
export async function deactivateCheckInCodeAction(
  workspaceSlug: string,
  codeId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD']);

  const code = await prisma.siteCheckInCode.findFirst({
    where: { id: codeId, workspaceId: workspace.id },
    select: { id: true, projectId: true, label: true },
  });
  if (!code) return { ok: false, error: 'Code not found' };

  await prisma.siteCheckInCode.update({
    where: { id: codeId },
    data: { isActive },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: userId,
      action: isActive ? 'updated' : 'updated',
      entityType: 'checkin_code',
      entityId: code.id,
      entityName: code.label,
      details: isActive
        ? `Re-activated check-in code "${code.label}"`
        : `Deactivated check-in code "${code.label}"`,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/checkin`);
  revalidatePath(`/w/${workspaceSlug}/checkin/${code.projectId}`);

  return { ok: true };
}

// =====================================================================
// PUBLIC: check in / check out
// =====================================================================

const checkInSchema = z.object({
  token: z.string().min(8, 'Token required'),
  subcontractorId: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type CheckInResult =
  | {
      ok: true;
      action: 'checked_in' | 'checked_out';
      projectId: string;
      projectName: string;
      whoName: string;
      when: string;
      // Distance in meters between the visitor's phone
      // GPS and the bound GPS of the code they scanned.
      // null = no bound GPS on the code, or the visitor
      // denied geolocation. The client uses this to
      // show a "you're X m from the check-in point"
      // banner on the success screen.
      geofenceDistanceMeters: number | null;
      // True if the check-in was within the geofence
      // (or no geofence is set). False if it was out
      // of range but still allowed.
      geofenceOk: boolean | null;
      // The geofence radius of the scanned code, so the
      // client can show "X m / Y m allowed" without an
      // extra round trip.
      geofenceRadiusMeters: number | null;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Toggle a check-in / check-out for a QR-scanned site.
 *
 * Resolves the token to a project + code. The "who" is
 * inferred as follows:
 *
 *   1. If a Clerk session is present (workspace member
 *      signed in on the same phone that scanned the QR),
 *      the user is attributed as the workspace member.
 *
 *   2. Otherwise (anonymous sub foreman), the caller
 *      MUST pass `subcontractorId` in the form. The
 *      sub's workspaceId is verified against the
 *      project's workspace so a token from one
 *      workspace can't be used to check into another.
 *
 * The function is idempotent in the right way: calling
 * it twice with no "checkout" in between is a no-op the
 * second time. Calling it when the person is already
 * checked in transitions them to "checked out".
 */
export async function toggleCheckInAction(
  _prev: CheckInResult | undefined,
  formData: FormData,
): Promise<CheckInResult> {
  const parsed = checkInSchema.safeParse({
    token: formData.get('token'),
    subcontractorId: (formData.get('subcontractorId') as string | null) || undefined,
    note: (formData.get('note') as string | null) || undefined,
    lat: formData.get('lat') || undefined,
    lng: formData.get('lng') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return {
      ok: false,
      error: 'Please fix the errors below',
      fieldErrors,
    };
  }

  // Resolve the token. Reject if the code doesn't exist
  // OR isActive=false. The retired-code rejection is the
  // whole point of the soft-delete.
  const code = await prisma.siteCheckInCode.findUnique({
    where: { token: parsed.data.token },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          workspaceId: true,
        },
      },
    },
  });
  if (!code) {
    return { ok: false, error: 'Code not found' };
  }
  if (!code.isActive) {
    return { ok: false, error: 'This check-in code has been retired' };
  }

  // Determine the "who".
  let userId: string | null = null;
  let userName = 'Unknown';
  let subcontractorId: string | null = null;
  let subName: string | null = null;

  // `auth()` is null when no Clerk session. We catch errors
  // so a misconfigured Clerk setup doesn't 500 every public
  // scan (subs should be able to check in even if auth is
  // temporarily down).
  try {
    const a = await auth();
    if (a?.userId) {
      userId = a.userId;
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      userName = u?.name ?? u?.email ?? 'Unknown user';
    }
  } catch {
    // ignore — proceed as anonymous
  }

  if (!userId) {
    if (!parsed.data.subcontractorId) {
      return {
        ok: false,
        error: 'Pick a subcontractor (you are not signed in)',
      };
    }
    // Verify the sub belongs to the same workspace as the
    // project. Without this check, a token from one
    // workspace could be used to attribute a check-in to a
    // sub in a different workspace.
    const sub = await prisma.subcontractor.findFirst({
      where: {
        id: parsed.data.subcontractorId,
        workspaceId: code.project.workspaceId,
      },
      select: { id: true, name: true },
    });
    if (!sub) {
      return { ok: false, error: 'Subcontractor not found in this workspace' };
    }
    subcontractorId = sub.id;
    subName = sub.name;
  }

  // Find the open check-in for this person on this project.
  // If present, close it. If absent, open one.
  const existing = await findOpenCheckIn(code.projectId, {
    userId,
    subcontractorId,
  });

  if (existing) {
    await prisma.checkInEvent.update({
      where: { id: existing.id },
      data: {
        checkedOutAt: new Date(),
        checkOutLat: parsed.data.lat,
        checkOutLng: parsed.data.lng,
        // Update geofence distance for the check-out too
        // (in case the visitor left the geofence at
        // check-out time — useful for the audit).
        ...(() => {
          if (
            code.lat != null &&
            code.lng != null &&
            parsed.data.lat != null &&
            parsed.data.lng != null
          ) {
            const distance = haversineMeters(
              { lat: code.lat, lng: code.lng },
              { lat: parsed.data.lat, lng: parsed.data.lng },
            );
            return { geofenceDistanceMeters: Math.round(distance) };
          }
          return {};
        })(),
      },
    });
    return {
      ok: true,
      action: 'checked_out',
      projectId: code.project.id,
      projectName: code.project.name,
      whoName: userId ? userName : (subName ?? 'Unknown'),
      when: new Date().toISOString(),
      geofenceDistanceMeters: null, // already persisted on the row above
      geofenceOk: null,
      geofenceRadiusMeters: code.geofenceMeters,
    };
  }

  // =========================================
  // Geofence verification on check-in
  // =========================================
  // If the code has a bound location and the visitor
  // shared their phone GPS, compute the distance and
  // decide whether to allow the check-in.
  let geofenceDistance: number | null = null;
  let geofenceOk: boolean | null = null;
  if (
    code.lat != null &&
    code.lng != null &&
    parsed.data.lat != null &&
    parsed.data.lng != null
  ) {
    const distance = haversineMeters(
      { lat: code.lat, lng: code.lng },
      { lat: parsed.data.lat, lng: parsed.data.lng },
    );
    geofenceDistance = Math.round(distance);
    const radius = code.geofenceMeters ?? 150;
    geofenceOk = distance <= radius;
    if (code.requireWithinGeofence && !geofenceOk) {
      return {
        ok: false,
        error: `You're ${geofenceDistance} m from the check-in point (allowed: ${radius} m). This code requires you to be on site.`,
      };
    }
  } else if (
    code.requireWithinGeofence &&
    (parsed.data.lat == null || parsed.data.lng == null)
  ) {
    // Hard-enforce + no GPS shared = reject. The visitor
    // denied geolocation and the site is gated.
    return {
      ok: false,
      error: 'This check-in requires location sharing. Please enable GPS and try again.',
    };
  }

  // Open a new check-in. We persist a ScanEvent alongside
  // (matched: 'checkin', matchedId: siteCheckInCodeId) so
  // the universal scan audit log shows the check-in.
  const event = await prisma.checkInEvent.create({
    data: {
      workspaceId: code.project.workspaceId,
      siteCheckInCodeId: code.id,
      projectId: code.project.id,
      userId,
      subcontractorId,
      checkedInAt: new Date(),
      note: parsed.data.note,
      checkInLat: parsed.data.lat,
      checkInLng: parsed.data.lng,
      geofenceDistanceMeters: geofenceDistance,
      geofenceOk,
    },
    select: { id: true, checkedInAt: true },
  });

  // ScanEvent.create is a best-effort audit write — the
  // user already saw the check-in succeed. A failure here
  // just means the scan log is missing a row.
  if (userId) {
    try {
      await prisma.scanEvent.create({
        data: {
          workspaceId: code.project.workspaceId,
          userId,
          code: parsed.data.token,
          source: 'camera',
          matched: 'checkin',
          matchedId: code.id,
        },
      });
    } catch (err) {
      console.error('[checkin] failed to write ScanEvent:', err);
    }
  }

  // Notification emit — ping PMs / admins / owners of
  // the workspace so the bell surfaces the new arrival.
  // We exclude the user themselves if they happen to
  // be one of those roles (they already know they're
  // on site). Sub-foreman check-ins (no userId) still
  // notify the whole team.
  try {
    const managers = await prisma.membership.findMany({
      where: {
        workspaceId: code.project.workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'PM'] },
      },
      select: { userId: true },
    });
    const managerIds = managers
      .map((m) => m.userId)
      .filter((id) => id !== userId);
    if (managerIds.length > 0) {
      await emitNotification({
        workspaceId: code.project.workspaceId,
        type: 'checkin',
        title: `${userId ? userName : (subName ?? 'Someone')} checked in`,
        body: `${code.project.name}${code.label ? ` · ${code.label}` : ''}`,
        link: `/projects/${code.project.id}/checkins`,
        recipientIds: managerIds,
        createdById: userId,
        metadata: {
          checkInEventId: event.id,
          projectId: code.project.id,
        },
      });
    }
  } catch (err) {
    // Best-effort — the check-in already succeeded.
    console.error('[checkin] failed to emit notification:', err);
  }

  return {
    ok: true,
    action: 'checked_in',
    projectId: code.project.id,
    projectName: code.project.name,
    whoName: userId ? userName : (subName ?? 'Unknown'),
    when: event.checkedInAt.toISOString(),
    geofenceDistanceMeters: geofenceDistance,
    geofenceOk,
    geofenceRadiusMeters: code.geofenceMeters,
  };
}
