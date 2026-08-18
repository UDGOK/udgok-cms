'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const permitSchema = z.object({
  permitNumber: z.string().max(80).optional(),
  type: z.string().min(1, 'Type is required').max(80),
  status: z.enum([
    'NOT_APPLIED',
    'APPLIED',
    'ISSUED',
    'INSPECTION_SCHEDULED',
    'PASSED',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
  ]).default('NOT_APPLIED'),
  jurisdiction: z.string().max(120).optional(),
  appliedDate: z.string().optional(),
  issuedDate: z.string().optional(),
  expirationDate: z.string().optional(),
  fee: z.coerce.number().min(0).optional(),
  notes: z.string().max(4000).optional(),
});

export type CreatePermitState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; id?: string }
  | undefined;

export async function createPermitAction(
  workspaceSlug: string,
  projectId: string,
  _prev: CreatePermitState,
  formData: FormData,
): Promise<CreatePermitState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return { error: 'Project not found' };

  const parsed = permitSchema.safeParse({
    permitNumber: formData.get('permitNumber') || undefined,
    type: formData.get('type'),
    status: formData.get('status') || 'NOT_APPLIED',
    jurisdiction: formData.get('jurisdiction') || undefined,
    appliedDate: formData.get('appliedDate') || undefined,
    issuedDate: formData.get('issuedDate') || undefined,
    expirationDate: formData.get('expirationDate') || undefined,
    fee: formData.get('fee') || undefined,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const permit = await prisma.permit.create({
    data: {
      workspaceId: workspace.id,
      projectId,
      permitNumber: parsed.data.permitNumber || null,
      type: parsed.data.type,
      status: parsed.data.status,
      jurisdiction: parsed.data.jurisdiction || null,
      appliedDate: parsed.data.appliedDate ? new Date(parsed.data.appliedDate) : null,
      issuedDate: parsed.data.issuedDate ? new Date(parsed.data.issuedDate) : null,
      expirationDate: parsed.data.expirationDate ? new Date(parsed.data.expirationDate) : null,
      fee: parsed.data.fee ?? null,
      notes: parsed.data.notes,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true, id: permit.id };
}

export async function updatePermitStatusAction(
  workspaceSlug: string,
  projectId: string,
  permitId: string,
  status: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const valid = [
    'NOT_APPLIED',
    'APPLIED',
    'ISSUED',
    'INSPECTION_SCHEDULED',
    'PASSED',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
  ];
  if (!valid.includes(status)) return { error: 'Invalid status' };

  const result = await prisma.permit.updateMany({
    where: { id: permitId, projectId, workspaceId: workspace.id },
    data: { status: status as 'NOT_APPLIED' | 'APPLIED' | 'ISSUED' | 'INSPECTION_SCHEDULED' | 'PASSED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' },
  });
  if (result.count === 0) return { error: 'Permit not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function deletePermitAction(
  workspaceSlug: string,
  projectId: string,
  permitId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const result = await prisma.permit.deleteMany({
    where: { id: permitId, projectId, workspaceId: workspace.id },
  });
  if (result.count === 0) return { error: 'Permit not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

// =========================================
// INSPECTIONS
// =========================================

const inspectionSchema = z.object({
  type: z.enum([
    'FOOTING',
    'FOUNDATION',
    'SLAB',
    'FRAMING',
    'SHEATHING',
    'ROUGH_PLUMBING',
    'ROUGH_ELECTRICAL',
    'ROUGH_MECHANICAL',
    'ROUGH_GAS',
    'INSULATION',
    'DRYWALL',
    'ROOFING',
    'WINDOW',
    'SIDING',
    'FINAL_PLUMBING',
    'FINAL_ELECTRICAL',
    'FINAL_MECHANICAL',
    'FINAL_BUILDING',
    'FIRE',
    'UTILITY',
    'CUSTOM',
  ]),
  scheduledDate: z.string().optional(),
  result: z.enum(['PENDING', 'PASSED', 'FAILED', 'PARTIAL', 'CANCELLED']).default('PENDING'),
  inspectorName: z.string().max(120).optional(),
  scheduledBy: z.string().max(120).optional(),
  notes: z.string().max(4000).optional(),
  completedDate: z.string().optional(),
});

export type CreateInspectionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function createInspectionAction(
  workspaceSlug: string,
  projectId: string,
  permitId: string,
  _prev: CreateInspectionState,
  formData: FormData,
): Promise<CreateInspectionState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const permit = await prisma.permit.findFirst({
    where: { id: permitId, projectId, workspaceId: workspace.id },
  });
  if (!permit) return { error: 'Permit not found' };

  const parsed = inspectionSchema.safeParse({
    type: formData.get('type'),
    scheduledDate: formData.get('scheduledDate') || undefined,
    result: formData.get('result') || 'PENDING',
    inspectorName: formData.get('inspectorName') || undefined,
    scheduledBy: formData.get('scheduledBy') || formData.get('inspectorName') || undefined,
    notes: formData.get('notes') || undefined,
    completedDate: formData.get('completedDate') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  await prisma.inspection.create({
    data: {
      workspaceId: workspace.id,
      permitId,
      type: parsed.data.type,
      result: parsed.data.result,
      scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : null,
      inspectorName: parsed.data.inspectorName || null,
      scheduledBy: parsed.data.scheduledBy || null,
      notes: parsed.data.notes,
      completedDate: parsed.data.completedDate ? new Date(parsed.data.completedDate) : null,
    },
  });

  // If the permit was ISSUED, bump it to INSPECTION_SCHEDULED
  if (permit.status === 'ISSUED' && parsed.data.scheduledDate) {
    await prisma.permit.update({
      where: { id: permitId },
      data: { status: 'INSPECTION_SCHEDULED' },
    });
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function updateInspectionResultAction(
  workspaceSlug: string,
  projectId: string,
  permitId: string,
  inspectionId: string,
  result: string,
  completedDate?: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'FIELD', 'ESTIMATOR']);

  const valid = ['PENDING', 'PASSED', 'FAILED', 'PARTIAL', 'CANCELLED'];
  if (!valid.includes(result)) return { error: 'Invalid result' };

  const upd = await prisma.inspection.updateMany({
    where: { id: inspectionId, permitId, workspaceId: workspace.id },
    data: {
      result: result as 'PENDING' | 'PASSED' | 'FAILED' | 'PARTIAL' | 'CANCELLED',
      completedDate: completedDate ? new Date(completedDate) : result === 'PASSED' || result === 'FAILED' ? new Date() : null,
    },
  });
  if (upd.count === 0) return { error: 'Inspection not found' };

  // If all inspections on this permit are PASSED, mark permit PASSED
  const inspections = await prisma.inspection.findMany({
    where: { permitId },
    select: { result: true },
  });
  const allPassed = inspections.every((i) => i.result === 'PASSED');
  const anyFailed = inspections.some((i) => i.result === 'FAILED');
  if (allPassed) {
    await prisma.permit.update({ where: { id: permitId }, data: { status: 'PASSED' } });
  } else if (anyFailed) {
    await prisma.permit.update({ where: { id: permitId }, data: { status: 'FAILED' } });
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function deleteInspectionAction(
  workspaceSlug: string,
  projectId: string,
  permitId: string,
  inspectionId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const result = await prisma.inspection.deleteMany({
    where: { id: inspectionId, permitId, workspaceId: workspace.id },
  });
  if (result.count === 0) return { error: 'Inspection not found' };

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true };
}
