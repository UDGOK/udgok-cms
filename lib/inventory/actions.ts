'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { EquipmentCondition } from '@prisma/client';

const materialSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  code: z.string().min(1, 'Code is required').max(200),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  unit: z.string().max(40).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  quantity: z.coerce.number().min(0).optional(),
});

const equipmentSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  code: z.string().min(1, 'Code is required').max(200),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  serialNumber: z.string().max(200).optional(),
  condition: z.nativeEnum(EquipmentCondition).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
});

/**
 * Result type for inventory create actions. Either ok with the
 * new material/equipment id, or an error message (and optional
 * per-field errors so the form can highlight the bad inputs).
 */
export type InventoryCreateState =
  | { ok: true; id: string; kind: 'material' | 'equipment' }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Create a new material on a project. Used both by the
 * scan-create flow (when a scanned code isn't found) and the
 * project INVENTORY tab's "Add material" button.
 *
 * Scoped to a single project: the same SKU on two different
 * jobs is two separate Material rows. The unique constraint
 * (workspaceId, projectId, code) enforces this at the DB level
 * so the user can't accidentally double-add a delivery.
 */
export async function createMaterialAction(
  workspaceSlug: string,
  _prev: InventoryCreateState | undefined,
  formData: FormData,
): Promise<InventoryCreateState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const parsed = materialSchema.safeParse({
    projectId: formData.get('projectId'),
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    unit: formData.get('unit') || undefined,
    unitCost: formData.get('unitCost') || undefined,
    quantity: formData.get('quantity') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  // Verify the project belongs to this workspace (defense
  // against the user passing a project id from a different
  // workspace via crafted form data).
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) {
    return { ok: false, error: 'Project not found in this workspace' };
  }

  // Detect duplicate code on the same project and surface a
  // friendly error instead of relying on the unique constraint
  // (which would throw a P2002 we'd have to catch in the catch).
  const existing = await prisma.material.findUnique({
    where: {
      material_code_per_project: {
        workspaceId: workspace.id,
        projectId: project.id,
        code: parsed.data.code,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `Code "${parsed.data.code}" already exists on this project. Edit the existing material instead.`,
      fieldErrors: { code: 'Already on this project' },
    };
  }

  const material = await prisma.material.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      uploaderId: userId,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      unit: parsed.data.unit || 'each',
      unitCost: parsed.data.unitCost ?? null,
      quantity: parsed.data.quantity ?? 0,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/scan`);
  revalidatePath(`/w/${workspaceSlug}/projects/${project.id}?tab=inventory`);
  return { ok: true, id: material.id, kind: 'material' };
}

/**
 * Create a new equipment on a project. Same scoping rules as
 * materials (projectId-scoped, code-unique per project). The
 * `quantity` for equipment is an integer count (you can't have
 * half a hammer) while materials use a Decimal (you can have
 * 2.5 sheets of drywall).
 */
export async function createEquipmentAction(
  workspaceSlug: string,
  _prev: InventoryCreateState | undefined,
  formData: FormData,
): Promise<InventoryCreateState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const parsed = equipmentSchema.safeParse({
    projectId: formData.get('projectId'),
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    serialNumber: formData.get('serialNumber') || undefined,
    condition: formData.get('condition') || undefined,
    unitCost: formData.get('unitCost') || undefined,
    quantity: formData.get('quantity') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) {
    return { ok: false, error: 'Project not found in this workspace' };
  }

  const existing = await prisma.equipment.findUnique({
    where: {
      equipment_code_per_project: {
        workspaceId: workspace.id,
        projectId: project.id,
        code: parsed.data.code,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `Code "${parsed.data.code}" already exists on this project. Edit the existing equipment instead.`,
      fieldErrors: { code: 'Already on this project' },
    };
  }

  const equipment = await prisma.equipment.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      uploaderId: userId,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      serialNumber: parsed.data.serialNumber || null,
      condition: parsed.data.condition || 'GOOD',
      unitCost: parsed.data.unitCost ?? null,
      quantity: parsed.data.quantity ?? 1,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/scan`);
  revalidatePath(`/w/${workspaceSlug}/projects/${project.id}?tab=inventory`);
  return { ok: true, id: equipment.id, kind: 'equipment' };
}
