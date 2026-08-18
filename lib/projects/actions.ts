'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { geocodeProjectAddress, buildAddressQuery } from '@/lib/geocoding';

import { DEFAULT_SOV_TEMPLATE } from '@/lib/construction/csi-masterformat';

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(40).optional(),
  clientId: z.string().optional(),
  description: z.string().max(4000).optional(),
  contractValue: z.coerce.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  seedTemplate: z.union([z.literal('on'), z.literal('true'), z.literal('1')]).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  zip: z.string().max(20).optional(),
});

export type CreateProjectState =
  | { error?: string; fieldErrors?: Record<string, string>; id?: string }
  | undefined;

export async function createProjectAction(
  workspaceSlug: string,
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = projectSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code') || undefined,
    clientId: formData.get('clientId') || undefined,
    description: formData.get('description') || undefined,
    contractValue: formData.get('contractValue') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
    seedTemplate: formData.get('seedTemplate') || undefined,
    address: formData.get('address') || undefined,
    city: formData.get('city') || undefined,
    state: formData.get('state') || undefined,
    zip: formData.get('zip') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Check for a project with the same name in this workspace — warn
  // (don't block) so the user can confirm they didn't double-submit.
  const existingByName = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, name: parsed.data.name },
    select: { id: true, name: true },
  });
  if (existingByName) {
    return {
      error: `A project named "${parsed.data.name}" already exists in this workspace. Pick a different name, or go to the existing project.`,
    };
  }

  // Compute the default SOV line budgets from the contract value + template %
  const contractValue = parsed.data.contractValue ?? 0;
  const template = parsed.data.seedTemplate ? DEFAULT_SOV_TEMPLATE : [];

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      code: parsed.data.code,
      clientId: parsed.data.clientId,
      description: parsed.data.description,
      contractValue: parsed.data.contractValue,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
    },
    select: { id: true },
  });

  // Fire-and-forget geocode. The form already has the project; we
  // don't make the user wait for the network round-trip. If the
  // geocoder succeeds, the project coords are filled in before the
  // next page render. If it fails, the user can hit "Re-geocode" on
  // the project page.
  const addressQuery = buildAddressQuery(parsed.data);
  if (addressQuery) {
    geocodeProjectAddress(parsed.data)
      .then((geo) => {
        if (!geo) return;
        return prisma.project.update({
          where: { id: project.id },
          data: {
            latitude: geo.latitude,
            longitude: geo.longitude,
            geocodedAt: new Date(),
            geocodeSource: geo.source,
            geocodedAddress: geo.formattedAddress,
          },
        });
      })
      .catch(() => {
        // Never block project creation on a geocode failure.
      });
  }

  // Seed the standard SOV template if the user opted in
  if (template.length > 0) {
    const lines = template.map((t, i) => ({
      projectId: project.id,
      code: t.code,
      trade: t.trade,
      budget: Math.round(contractValue * (t.pctOfBudget / 100) * 100) / 100,
      sortOrder: i + 1,
    }));
    // Fix rounding drift: add the difference to the last line so total = contract
    const totalFromTemplate = lines.reduce((acc, l) => acc + l.budget, 0);
    const drift = Math.round((contractValue - totalFromTemplate) * 100) / 100;
    if (lines.length > 0 && Math.abs(drift) >= 0.01) {
      lines[lines.length - 1].budget = Math.round((lines[lines.length - 1].budget + drift) * 100) / 100;
    }
    await prisma.projectDivision.createMany({ data: lines });
  }

  revalidatePath(`/w/${workspaceSlug}/projects`);
  return { id: project.id };
}

const divisionSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  trade: z.string().min(1, 'Trade is required').max(120),
  subcontractorName: z.string().max(120).optional(),
  budget: z.coerce.number().min(0),
});

export type CreateDivisionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function createDivisionAction(
  workspaceSlug: string,
  projectId: string,
  _prev: CreateDivisionState,
  formData: FormData,
): Promise<CreateDivisionState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  // Verify project belongs to this workspace
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = divisionSchema.safeParse({
    code: formData.get('code'),
    trade: formData.get('trade'),
    subcontractorName: formData.get('subcontractorName') || undefined,
    budget: formData.get('budget'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const lastSort = await prisma.projectDivision.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });

  await prisma.projectDivision.create({
    data: {
      projectId,
      code: parsed.data.code,
      trade: parsed.data.trade,
      subcontractorName: parsed.data.subcontractorName,
      budget: parsed.data.budget,
      sortOrder: (lastSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export type UpdateDivisionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

/**
 * Edit an existing Schedule of Values line — code, trade, subcontractor
 * name, budget. Used for both manually-added lines and lines that came
 * from the auto-generated CSI template (which otherwise had no way to
 * be corrected after project creation).
 */
export async function updateDivisionAction(
  workspaceSlug: string,
  projectId: string,
  divisionId: string,
  _prev: UpdateDivisionState,
  formData: FormData,
): Promise<UpdateDivisionState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  // Verify project belongs to this workspace, and division belongs to project
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const division = await prisma.projectDivision.findFirst({ where: { id: divisionId, projectId } });
  if (!division) return { error: 'Division not found' };

  const parsed = divisionSchema.safeParse({
    code: formData.get('code'),
    trade: formData.get('trade'),
    subcontractorName: formData.get('subcontractorName') || undefined,
    budget: formData.get('budget'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  await prisma.projectDivision.update({
    where: { id: divisionId },
    data: {
      code: parsed.data.code,
      trade: parsed.data.trade,
      subcontractorName: parsed.data.subcontractorName,
      budget: parsed.data.budget,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

/**
 * Delete a Schedule of Values line. Blocked if the division already has
 * pay app history (PayAppDivision has no cascade on this FK — see
 * deleteWorkspaceAction for the same relation) so we never silently lose
 * billing records; the user has to remove it from the pay app(s) first.
 */
export async function deleteDivisionAction(
  workspaceSlug: string,
  projectId: string,
  divisionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { ok: false, error: 'Project not found' };

  const division = await prisma.projectDivision.findFirst({ where: { id: divisionId, projectId } });
  if (!division) return { ok: false, error: 'Division not found' };

  const billedLineCount = await prisma.payAppDivision.count({ where: { projectDivisionId: divisionId } });
  if (billedLineCount > 0) {
    return {
      ok: false,
      error: `Can't delete — this division appears on ${billedLineCount} pay app line${billedLineCount === 1 ? '' : 's'}. Remove it from those pay apps first.`,
    };
  }

  // ProjectDivisionAssignment cascades via schema, safe to delete directly.
  await prisma.projectDivision.delete({ where: { id: divisionId } });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// PROJECT DETAILS (address, status, etc.)
// =========================================

const updateProjectDetailsSchema = z.object({
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  zip: z.string().max(20).optional(),
  description: z.string().max(4000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  contractValue: z.coerce.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  // Manual lat/lng override. If present, geocodeSource is forced to
  // 'manual' and future auto-geocodes are skipped unless the user
  // hits "Re-geocode" on the project page.
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  // Explicit "force re-geocode from current address" signal. Sent
  // when the user clicks the Re-geocode button.
  forceRegeocode: z.union([z.literal('on'), z.literal('true'), z.literal('1')]).optional(),
});

export type UpdateProjectDetailsState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function updateProjectDetailsAction(
  workspaceSlug: string,
  projectId: string,
  _prev: UpdateProjectDetailsState,
  formData: FormData,
): Promise<UpdateProjectDetailsState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = updateProjectDetailsSchema.safeParse({
    address: formData.get('address') ?? undefined,
    city: formData.get('city') ?? undefined,
    state: formData.get('state') ?? undefined,
    zip: formData.get('zip') ?? undefined,
    description: formData.get('description') ?? undefined,
    startDate: formData.get('startDate') ?? undefined,
    endDate: formData.get('endDate') ?? undefined,
    contractValue: formData.get('contractValue') ?? undefined,
    status: formData.get('status') ?? undefined,
    latitude: formData.get('latitude') ?? undefined,
    longitude: formData.get('longitude') ?? undefined,
    forceRegeocode: formData.get('forceRegeocode') ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Determine whether to auto-geocode after the update.
  // We re-geocode if any address field changed AND the user hasn't
  // pinned the location manually. A manual override is sticky until
  // the user explicitly clicks "Re-geocode".
  const addressChanged =
    (parsed.data.address ?? null) !== project.address ||
    (parsed.data.city ?? null) !== project.city ||
    (parsed.data.state ?? null) !== project.state ||
    (parsed.data.zip ?? null) !== project.zip;
  const hasManualOverride =
    parsed.data.latitude !== undefined && parsed.data.longitude !== undefined;
  const forceRegeocode = parsed.data.forceRegeocode != null;
  const shouldGeocode = (addressChanged && !hasManualOverride) || forceRegeocode;
  const isManualPin = hasManualOverride && !forceRegeocode;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      description: parsed.data.description,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      contractValue: parsed.data.contractValue,
      status: parsed.data.status,
      // Manual pin wins: clear auto-geocode provenance and lock coords
      // to whatever the user typed. Future edits won't auto-override.
      ...(isManualPin
        ? {
            latitude: parsed.data.latitude!,
            longitude: parsed.data.longitude!,
            geocodedAt: new Date(),
            geocodeSource: 'manual',
            geocodedAddress: `${parsed.data.latitude!.toFixed(6)}, ${parsed.data.longitude!.toFixed(6)} (manually pinned)`,
          }
        : {}),
      // If we're about to auto-geocode, clear the previous coords so a
      // failed re-geocode doesn't leave a misleading pin.
      ...(shouldGeocode && !isManualPin
        ? {
            latitude: null,
            longitude: null,
            geocodedAt: null,
            geocodeSource: null,
            geocodedAddress: null,
          }
        : {}),
    },
  });

  // Fire-and-forget geocode. If the user manually pinned, this branch
  // is skipped (shouldGeocode=false). If forceRegeocode was sent, we
  // re-run even if the address hasn't changed.
  if (shouldGeocode) {
    const nextAddress = parsed.data.address ?? project.address;
    const nextCity = parsed.data.city ?? project.city;
    const nextState = parsed.data.state ?? project.state;
    const nextZip = parsed.data.zip ?? project.zip;
    geocodeProjectAddress({
      address: nextAddress,
      city: nextCity,
      state: nextState,
      zip: nextZip,
    })
      .then((geo) => {
        if (!geo) return;
        return prisma.project.update({
          where: { id: projectId },
          data: {
            latitude: geo.latitude,
            longitude: geo.longitude,
            geocodedAt: new Date(),
            geocodeSource: geo.source,
            geocodedAddress: geo.formattedAddress,
          },
        });
      })
      .catch(() => {
        // Swallowed — a failed geocode just leaves coords null. The
        // user can hit "Re-geocode" to retry.
      });
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// PROJECT TEAM (members involved)
// =========================================

const addMemberSchema = z.object({
  userId: z.string().min(1, 'Pick a teammate'),
  role: z.string().max(80).optional(),
});

export type AddProjectMemberState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function addProjectMemberAction(
  workspaceSlug: string,
  projectId: string,
  _prev: AddProjectMemberState,
  formData: FormData,
): Promise<AddProjectMemberState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = addMemberSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Verify user is a workspace member
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: parsed.data.userId, workspaceId: workspace.id } },
  });
  if (!membership) return { error: 'User is not a member of this workspace' };

  // Idempotent — upsert by (projectId, userId) unique constraint
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: parsed.data.userId } },
    update: { role: parsed.data.role || null },
    create: {
      projectId,
      userId: parsed.data.userId,
      role: parsed.data.role || null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function removeProjectMemberAction(
  workspaceSlug: string,
  projectId: string,
  userId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// PROJECT TASKS (in-page CRUD)
// =========================================

const projectTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']).default('TODO'),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

export type CreateProjectTaskState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function createProjectTaskAction(
  workspaceSlug: string,
  projectId: string,
  _prev: CreateProjectTaskState,
  formData: FormData,
): Promise<CreateProjectTaskState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!project) return { error: 'Project not found' };

  const parsed = projectTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    priority: formData.get('priority') || 'NORMAL',
    status: formData.get('status') || 'TODO',
    dueDate: formData.get('dueDate') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: parsed.data.status,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      assigneeId: parsed.data.assigneeId || null,
      createdById: userId,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function updateProjectTaskStatusAction(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
  status: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const valid = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
  if (!valid.includes(status)) return { error: 'Invalid status' };

  const result = await prisma.task.updateMany({
    where: { id: taskId, projectId, workspaceId: workspace.id },
    data: { status: status as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED' },
  });
  if (result.count === 0) return { error: 'Task not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function deleteProjectTaskAction(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const result = await prisma.task.deleteMany({
    where: { id: taskId, projectId, workspaceId: workspace.id },
  });
  if (result.count === 0) return { error: 'Task not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// GEOCODING
// =========================================

export type RegeocodeState =
  | { error?: string; ok?: boolean; latitude?: number; longitude?: number; formattedAddress?: string }
  | undefined;

/**
 * Force-re-geocode the project's current address. Used by the
 * "Re-geocode" button on the project page.
 *
 * Returns the new coords on success so the UI can show them
 * immediately without waiting for the revalidate.
 */
export async function regeocodeProjectAction(
  workspaceSlug: string,
  projectId: string,
): Promise<RegeocodeState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true, address: true, city: true, state: true, zip: true, geocodeSource: true },
  });
  if (!project) return { error: 'Project not found' };

  // Clear the current pin first so a failed geocode doesn't leave a
  // stale "nominatim" source pointing at the wrong spot.
  await prisma.project.update({
    where: { id: projectId },
    data: {
      latitude: null,
      longitude: null,
      geocodedAt: null,
      geocodeSource: null,
      geocodedAddress: null,
    },
  });

  const geo = await geocodeProjectAddress(project);
  if (!geo) {
    revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
    return { error: "Couldn't find this address. Check it and try again, or pin the location manually." };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      latitude: geo.latitude,
      longitude: geo.longitude,
      geocodedAt: new Date(),
      geocodeSource: geo.source,
      geocodedAddress: geo.formattedAddress,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return {
    ok: true,
    latitude: geo.latitude,
    longitude: geo.longitude,
    formattedAddress: geo.formattedAddress,
  };
}

/**
 * Clear any manually-pinned location so the next address edit will
 * auto-geocode again. The current pin stays on the project until the
 * next edit triggers a re-geocode, OR until the user types fresh
 * coords and saves.
 */
export async function clearManualPinAction(
  workspaceSlug: string,
  projectId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const result = await prisma.project.updateMany({
    where: { id: projectId, workspaceId: workspace.id },
    data: {
      latitude: null,
      longitude: null,
      geocodedAt: null,
      geocodeSource: null,
      geocodedAddress: null,
    },
  });
  if (result.count === 0) return { error: 'Project not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// BIM TAKEOFF
// =========================================

export type RunTakeoffState =
  | { ok?: boolean; error?: string; takeoffId?: string; status?: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' }
  | undefined;

/**
 * Kick off a takeoff run. Creates a `BimTakeoff` row in PENDING,
 * then calls the Python service, then updates the row to DONE/FAILED.
 *
 * The call is synchronous: Vercel Pro lets the page that renders
 * the takeoff tab use `maxDuration = 300`, so we can wait for the
 * service to return. For files that take longer, we'd need to flip
 * this to an async pattern (PENDING → service webhook → DONE) but
 * the schema already supports that.
 */
export async function runTakeoffAction(
  workspaceSlug: string,
  projectId: string,
  bimModelId: string,
): Promise<RunTakeoffState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) return { error: 'Project not found' };

  const bim = await prisma.bimModel.findFirst({
    where: { id: bimModelId, projectId, workspaceId: workspace.id },
    select: { id: true, url: true },
  });
  if (!bim) return { error: 'BIM model not found' };

  // Idempotency: if a takeoff for this BIM model is already RUNNING,
  // don't start another one. The UI also gates the button, but
  // double-click + network blips can both create two calls.
  const existing = await prisma.bimTakeoff.findFirst({
    where: { bimModelId: bim.id, status: 'RUNNING' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return { ok: true, takeoffId: existing.id, status: 'RUNNING' };
  }

  const takeoff = await prisma.bimTakeoff.create({
    data: {
      bimModelId: bim.id,
      projectId,
      workspaceId: workspace.id,
      status: 'RUNNING',
    },
    select: { id: true },
  });

  const serviceUrl = process.env.UDGOK_CMS_TAKEOFF_SERVICE_URL;
  const apiKey = process.env.UDGOK_CMS_TAKEOFF_API_KEY;
  if (!serviceUrl || !apiKey) {
    await prisma.bimTakeoff.update({
      where: { id: takeoff.id },
      data: {
        status: 'FAILED',
        error:
          'Takeoff service is not configured. Set UDGOK_CMS_TAKEOFF_SERVICE_URL and UDGOK_CMS_TAKEOFF_API_KEY.',
      },
    });
    return { error: 'Takeoff service not configured' };
  }

  try {
    const res = await fetch(`${serviceUrl}/takeoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Takeoff-Key': apiKey,
      },
      body: JSON.stringify({ url: bim.url }),
      // 280s — leaves headroom under the 300s page maxDuration.
      signal: AbortSignal.timeout(280_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`takeoff service ${res.status}: ${text.slice(0, 300)}`);
    }
    const result = (await res.json()) as import('@/lib/takeoff/types').TakeoffResult;
    await prisma.bimTakeoff.update({
      where: { id: takeoff.id },
      data: { status: 'DONE', result: result as unknown as object },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await prisma.bimTakeoff.update({
      where: { id: takeoff.id },
      data: { status: 'FAILED', error: msg.slice(0, 2000) },
    });
    return { takeoffId: takeoff.id, status: 'FAILED', error: msg.slice(0, 300) };
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}?tab=takeoff`);
  return { ok: true, takeoffId: takeoff.id, status: 'DONE' };
}

const pushLineSchema = z.object({
  csiCode: z.string().min(1).max(20),
  trade: z.string().min(1).max(120),
  budget: z.coerce.number().min(0),
});

export type PushTakeoffToSovState =
  | { ok?: boolean; error?: string; created?: number; skipped?: number }
  | undefined;

/**
 * Push selected takeoff lines to the project's Schedule of Values.
 * Creates one `ProjectDivision` per line. Skips CSI codes that
 * already exist on the SOV (re-running a takeoff after a model
 * update shouldn't double the schedule). Budgets are
 * `quantity * unit cost` — the UI computes the unit cost from
 * estimator input, this action trusts the number it's given.
 */
export async function pushTakeoffToSovAction(
  workspaceSlug: string,
  projectId: string,
  takeoffId: string,
  lines: Array<{ csiCode: string; trade: string; budget: number }>,
): Promise<PushTakeoffToSovState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) return { error: 'Project not found' };

  const takeoff = await prisma.bimTakeoff.findFirst({
    where: { id: takeoffId, projectId, workspaceId: workspace.id, status: 'DONE' },
    select: { id: true },
  });
  if (!takeoff) return { error: 'Takeoff not found or not complete' };

  const parsed = z.array(pushLineSchema).min(1).max(100).safeParse(lines);
  if (!parsed.success) return { error: 'Invalid line data' };

  // Transaction so the existing-codes check + insert are atomic.
  // Two simultaneous pushes from two estimators would otherwise
  // race on sortOrder and create duplicates.
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.projectDivision.findMany({
      where: { projectId },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((d) => d.code));
    const fresh = parsed.data.filter((l) => !existingCodes.has(l.csiCode));
    if (fresh.length === 0) {
      // All lines are duplicates — nothing to create. We DON'T throw
      // here (that would poison the transaction for no reason); we
      // surface it as ok:false after the transaction commits.
      return { created: 0, skipped: parsed.data.length, allDuplicates: true };
    }
    const maxSort = await tx.projectDivision.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    let sort = (maxSort._max.sortOrder ?? 0) + 1;
    await tx.projectDivision.createMany({
      data: fresh.map((l) => ({
        projectId,
        code: l.csiCode,
        trade: l.trade,
        budget: l.budget,
        sortOrder: sort++,
      })),
    });
    return { created: fresh.length, skipped: parsed.data.length - fresh.length, allDuplicates: false };
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  if (result.allDuplicates) {
    return {
      ok: false,
      error: 'All of these CSI codes already exist on the SOV',
      created: 0,
      skipped: result.skipped,
    };
  }
  return { ok: true, created: result.created, skipped: result.skipped };
}

/**
 * Delete a BIM model and all its takeoffs. The IFC file stays in
 * Vercel Blob (separate orphan-cleanup job) until the user opts to
 * wipe it. Workspace owners / master admins only.
 */
export async function deleteBimModelAction(
  workspaceSlug: string,
  projectId: string,
  bimModelId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const result = await prisma.bimModel.deleteMany({
    where: { id: bimModelId, projectId, workspaceId: workspace.id },
  });
  if (result.count === 0) return { error: 'BIM model not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}?tab=takeoff`);
  return { ok: true };
}

/**
 * Convert a Won deal into a project. Pre-fills the new project
 * with the deal's title, client, value, and description, and
 * migrates the deal's files (proposal PDFs, contracts, etc.)
 * onto the new project so nothing is lost. The deal is marked
 * WON if it isn't already.
 *
 * Idempotent: if a project already exists for this deal
 * (project.dealId === deal.id), the action just returns that
 * project's id without creating a duplicate.
 *
 * Returns the new (or existing) project id so the caller can
 * redirect to /w/{slug}/projects/{id}.
 */
export type ConvertDealToProjectState =
  | { ok: true; projectId: string; alreadyConverted: boolean }
  | { ok: false; error: string };

export async function convertDealToProjectAction(
  workspaceSlug: string,
  dealId: string,
): Promise<ConvertDealToProjectState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId: workspace.id },
    include: {
      convertedProject: { select: { id: true } },
    },
  });
  if (!deal) return { ok: false, error: 'Deal not found' };

  // Idempotency: if a project already exists for this deal, just
  // hand back its id. Avoids the "I clicked twice, now I have two
  // projects" footgun.
  if (deal.convertedProject) {
    return { ok: true, projectId: deal.convertedProject.id, alreadyConverted: true };
  }

  // Pick a project name. If a project with the same name already
  // exists in the workspace, suffix the deal id (truncated) so
  // conversion doesn't collide on `name`. The createProjectAction
  // blocks duplicate names, so this is a defense-in-depth.
  const baseName = deal.title.trim();
  const existing = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, name: baseName },
    select: { id: true },
  });
  const projectName = existing
    ? `${baseName} (from deal ${deal.id.slice(0, 6)})`
    : baseName;

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        workspaceId: workspace.id,
        clientId: deal.clientId,
        dealId: deal.id,
        name: projectName,
        description: deal.description,
        contractValue: deal.value,
        // startDate / endDate are intentionally left null. The
        // estimator sets them on the project page once they
        // actually have a contract and a schedule. Pre-filling
        // expectedClose would be wrong because deal.expectedClose
        // is a sales target, not a project start date.
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    // Migrate deal files to the new project. The File model has
    // both dealId and projectId (both optional). Move them.
    // We keep the original dealId set to null so the deal's
    // own "files" view doesn't double-count the row.
    await tx.file.updateMany({
      where: { dealId: deal.id, workspaceId: workspace.id },
      data: { dealId: null, projectId: project.id },
    });

    // Mark the deal as WON if it isn't already. We don't enforce
    // this — a PM might convert a deal that's still in
    // NEGOTIATING (e.g. "we've agreed on terms, project starts
    // Monday"). The pipeline just gets a heads-up that this
    // deal now has a live project.
    if (deal.stage !== 'WON' && deal.stage !== 'LOST') {
      await tx.deal.update({
        where: { id: deal.id },
        data: { stage: 'WON', closedAt: deal.closedAt ?? new Date() },
      });
    }

    return project;
  });

  revalidatePath(`/w/${workspaceSlug}/deals/${deal.id}`);
  revalidatePath(`/w/${workspaceSlug}/deals`);
  revalidatePath(`/w/${workspaceSlug}/projects`);
  return { ok: true, projectId: result.id, alreadyConverted: false };
}
