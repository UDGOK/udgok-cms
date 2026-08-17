'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

// =========================================
// SUBCONTRACTORS — library CRUD
// =========================================

const subSchema = z.object({
  name: z.string().min(1, 'Name is required').max(160),
  primaryTrade: z.string().max(20).optional(),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  licenseNumber: z.string().max(60).optional(),
  insuranceExpiry: z.string().optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
  w9OnFile: z.union([z.literal('on'), z.literal('true'), z.literal('1')]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export type CreateSubState = { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined;

export async function createSubcontractorAction(
  workspaceSlug: string,
  _prev: CreateSubState,
  formData: FormData,
): Promise<CreateSubState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = subSchema.safeParse({
    name: formData.get('name'),
    primaryTrade: formData.get('primaryTrade') || undefined,
    contactName: formData.get('contactName') || undefined,
    contactEmail: formData.get('contactEmail') || undefined,
    contactPhone: formData.get('contactPhone') || undefined,
    address: formData.get('address') || undefined,
    licenseNumber: formData.get('licenseNumber') || undefined,
    insuranceExpiry: formData.get('insuranceExpiry') || undefined,
    hourlyRate: formData.get('hourlyRate') || undefined,
    notes: formData.get('notes') || undefined,
    w9OnFile: formData.get('w9OnFile') || undefined,
    rating: formData.get('rating') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const sub = await prisma.subcontractor.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      primaryTrade: parsed.data.primaryTrade,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail || undefined,
      contactPhone: parsed.data.contactPhone,
      address: parsed.data.address,
      licenseNumber: parsed.data.licenseNumber,
      insuranceExpiry: parsed.data.insuranceExpiry ? new Date(parsed.data.insuranceExpiry) : null,
      hourlyRate: parsed.data.hourlyRate,
      notes: parsed.data.notes,
      w9OnFile: !!parsed.data.w9OnFile,
      rating: parsed.data.rating,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/subcontractors`);
  return { id: sub.id };
}

// =========================================
// PROJECT ↔ SUBCONTRACTOR wiring
// =========================================

const assignmentSchema = z.object({
  subcontractorId: z.string().min(1),
  contractAmount: z.coerce.number().min(0).optional(),
  status: z.enum(['PROPOSED', 'CONTRACTED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional(),
  divisionIds: z.string().optional(), // JSON array of division IDs
});

export async function assignSubcontractorAction(
  workspaceSlug: string,
  projectId: string,
  _prev: { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  formData: FormData,
) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) return { error: 'Project not found' };

  const parsed = assignmentSchema.safeParse({
    subcontractorId: formData.get('subcontractorId'),
    contractAmount: formData.get('contractAmount') || undefined,
    status: formData.get('status') || 'PROPOSED',
    notes: formData.get('notes') || undefined,
    divisionIds: formData.get('divisionIds') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Verify the sub is in this workspace
  const sub = await prisma.subcontractor.findFirst({
    where: { id: parsed.data.subcontractorId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!sub) return { error: 'Subcontractor not found' };

  // Parse the division IDs
  let divisionIds: string[] = [];
  if (parsed.data.divisionIds) {
    try {
      const parsed2 = JSON.parse(parsed.data.divisionIds);
      if (Array.isArray(parsed2)) divisionIds = parsed2.filter((x) => typeof x === 'string');
    } catch {
      // ignore
    }
  }

  // Verify all division IDs belong to this project
  if (divisionIds.length > 0) {
    const valid = await prisma.projectDivision.findMany({
      where: { id: { in: divisionIds }, projectId },
      select: { id: true, budget: true },
    });
    const validIds = new Set(valid.map((v) => v.id));
    divisionIds = divisionIds.filter((id) => validIds.has(id));
  }

  const assignment = await prisma.projectSubcontractorAssignment.create({
    data: {
      projectId,
      subcontractorId: sub.id,
      contractAmount: parsed.data.contractAmount ?? 0,
      status: parsed.data.status ?? 'PROPOSED',
      notes: parsed.data.notes,
    },
    select: { id: true },
  });

  if (divisionIds.length > 0) {
    await prisma.projectDivisionAssignment.createMany({
      data: divisionIds.map((divisionId) => ({
        assignmentId: assignment.id,
        divisionId,
        amount: 0, // amount is per-division; can be edited later
      })),
    });
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function unassignSubcontractorAction(
  workspaceSlug: string,
  projectId: string,
  assignmentId: string,
) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  await prisma.projectSubcontractorAssignment.deleteMany({
    where: {
      id: assignmentId,
      project: { id: projectId, workspaceId: workspace.id },
    },
  });
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// EDIT / DELETE a subcontractor in the library
// =========================================

export type EditSubState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

export async function updateSubcontractorAction(
  workspaceSlug: string,
  subId: string,
  _prev: EditSubState,
  formData: FormData,
): Promise<EditSubState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = subSchema.safeParse({
    name: formData.get('name'),
    primaryTrade: formData.get('primaryTrade') || undefined,
    contactName: formData.get('contactName') || undefined,
    contactEmail: formData.get('contactEmail') || undefined,
    contactPhone: formData.get('contactPhone') || undefined,
    address: formData.get('address') || undefined,
    licenseNumber: formData.get('licenseNumber') || undefined,
    insuranceExpiry: formData.get('insuranceExpiry') || undefined,
    hourlyRate: formData.get('hourlyRate') || undefined,
    notes: formData.get('notes') || undefined,
    w9OnFile: formData.get('w9OnFile') || undefined,
    rating: formData.get('rating') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Verify sub belongs to this workspace
  const existing = await prisma.subcontractor.findFirst({
    where: { id: subId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!existing) return { error: 'Subcontractor not found' };

  await prisma.subcontractor.update({
    where: { id: subId },
    data: {
      name: parsed.data.name,
      primaryTrade: parsed.data.primaryTrade,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail || undefined,
      contactPhone: parsed.data.contactPhone,
      address: parsed.data.address,
      licenseNumber: parsed.data.licenseNumber,
      insuranceExpiry: parsed.data.insuranceExpiry ? new Date(parsed.data.insuranceExpiry) : null,
      hourlyRate: parsed.data.hourlyRate,
      notes: parsed.data.notes,
      w9OnFile: !!parsed.data.w9OnFile,
      rating: parsed.data.rating,
    },
  });

  // Activity log
  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'updated',
    entityType: 'subcontractor',
    entityId: subId,
    entityName: parsed.data.name,
    details: `Updated subcontractor details`,
  });

  revalidatePath(`/w/${workspaceSlug}/subcontractors`);
  revalidatePath(`/w/${workspaceSlug}/subcontractors/${subId}`);
  return { ok: true };
}

export async function deleteSubcontractorAction(workspaceSlug: string, subId: string) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN']);

  const existing = await prisma.subcontractor.findFirst({
    where: { id: subId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!existing) return { error: 'Subcontractor not found' };

  await prisma.subcontractor.delete({ where: { id: subId } });

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'deleted',
    entityType: 'subcontractor',
    entityId: subId,
    entityName: existing.name,
    details: `Removed from vendor library`,
  });

  revalidatePath(`/w/${workspaceSlug}/subcontractors`);
  return { ok: true };
}
