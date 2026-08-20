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
  // Vendor info — captured at scan time so the foreman
  // re-scanning a delivery doesn't have to retype the
  // supplier. All optional; vendor-less creates still work
  // (e.g. materials from an unknown source).
  vendor: z.string().max(200).optional(),
  vendorPartNumber: z.string().max(200).optional(),
  vendorContact: z.string().max(500).optional(),
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
 *
 * The Material path also returns a `duplicate` payload when
 * the (projectId, code) pair already exists — the client form
 * uses this to render an inline "Add ___ to quantity" form
 * instead of bouncing the user back to scan a different code.
 */
export type InventoryCreateState =
  | { ok: true; id: string; kind: 'material' | 'equipment' }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; duplicate?: DuplicateMaterialPayload };

/**
 * Payload returned by createMaterialAction when the scanned
 * code already exists on the chosen project. The form uses
 * this to render an "add N to quantity" form without leaving
 * the page.
 */
export interface DuplicateMaterialPayload {
  materialId: string;
  name: string;
  unit: string;
  currentQuantity: string;
}

/**
 * Increment a material's on-hand quantity by N. Called by the
 * scan-create form when the foreman re-scans a code that
 * already exists on the project — they enter the delivery
 * count and we add it to the existing balance. No new Material
 * row is created.
 *
 * The (workspace, project) check is the same defense-in-depth
 * we use on create: even if the client sends a malicious
 * materialId, we re-verify it belongs to this workspace
 * before doing anything.
 */
export async function incrementMaterialQuantityAction(
  workspaceSlug: string,
  _prev: InventoryCreateState | undefined,
  formData: FormData,
): Promise<InventoryCreateState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const materialId = String(formData.get('materialId') ?? '');
  const addRaw = formData.get('addQuantity');
  const add = Number(addRaw);
  if (!materialId) {
    return { ok: false, error: 'Missing material reference' };
  }
  if (!Number.isFinite(add) || add <= 0) {
    return {
      ok: false,
      error: 'Enter a quantity greater than zero',
      fieldErrors: { addQuantity: 'Must be > 0' },
    };
  }

  // Verify the material belongs to this workspace. We use
  // findFirst instead of updateUnique so we can scope to
  // workspaceId in one query.
  const existing = await prisma.material.findFirst({
    where: { id: materialId, workspaceId: workspace.id },
    select: { id: true, projectId: true, name: true, unit: true, quantity: true },
  });
  if (!existing) {
    return { ok: false, error: 'Material not found in this workspace' };
  }

  await prisma.material.update({
    where: { id: existing.id },
    data: { quantity: { increment: add } },
  });

  revalidatePath(`/w/${workspaceSlug}/scan`);
  revalidatePath(`/w/${workspaceSlug}/projects/${existing.projectId}?tab=inventory`);
  return {
    ok: true,
    id: existing.id,
    kind: 'material',
  };
}

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

  // Helper: an empty FormData entry might be '', null, or
  // whitespace-only (the user typed a space and tabbed
  // away). We normalize all of those to undefined so the
  // schema treats them as "not provided" and we end up
  // with null in the DB instead of a string of spaces.
  const opt = (v: FormDataEntryValue | null) => {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length === 0 ? undefined : s;
  };

  const parsed = materialSchema.safeParse({
    projectId: formData.get('projectId'),
    code: formData.get('code'),
    name: formData.get('name'),
    description: opt(formData.get('description')),
    unit: opt(formData.get('unit')),
    unitCost: formData.get('unitCost') || undefined,
    quantity: formData.get('quantity') || undefined,
    vendor: opt(formData.get('vendor')),
    vendorPartNumber: opt(formData.get('vendorPartNumber')),
    vendorContact: opt(formData.get('vendorContact')),
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

  // Detect duplicate code on the same project. The old
  // behaviour was to error out and send the foreman back to
  // the form — terrible UX when a delivery driver hands you
  // a 2nd pallet of the same SKU you already logged five
  // minutes ago. Instead, we return a structured
  // `duplicate` payload that the client component turns
  // into a one-tap "Add ___ to quantity" form. The foreman
  // picks how many they got on this delivery and the server
  // bumps the on-hand count.
  const existing = await prisma.material.findUnique({
    where: {
      material_code_per_project: {
        workspaceId: workspace.id,
        projectId: project.id,
        code: parsed.data.code,
      },
    },
    select: {
      id: true,
      name: true,
      unit: true,
      quantity: true,
    },
  });
  if (existing) {
    return {
      ok: false,
      error: `Code "${parsed.data.code}" already exists on this project.`,
      fieldErrors: { code: 'Already on this project' },
      duplicate: {
        materialId: existing.id,
        name: existing.name,
        unit: existing.unit,
        currentQuantity: existing.quantity.toString(),
      },
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
      vendor: parsed.data.vendor || null,
      vendorPartNumber: parsed.data.vendorPartNumber || null,
      vendorContact: parsed.data.vendorContact || null,
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
