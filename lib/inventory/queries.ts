import { prisma } from '@/lib/db/client';

/**
 * Material list item — same shape the project INVENTORY tab
 * needs to render a row. Decimals are serialized to strings
 * for safe transport to the client.
 */
export interface MaterialRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  unitCost: string | null;
  quantity: string; // Decimal serialized
  createdAt: Date;
}

export interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  serialNumber: string | null;
  condition: string;
  unitCost: string | null;
  quantity: number;
  createdAt: Date;
}

/**
 * List every material on a project. Newest first so freshly-
 * scanned-and-created rows appear at the top of the list,
 * which is what the user wants when they just scanned a code
 * and want to see the new row.
 */
export async function listProjectMaterials(
  projectId: string,
): Promise<MaterialRow[]> {
  const rows = await prisma.material.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    description: m.description,
    unit: m.unit,
    unitCost: m.unitCost ? m.unitCost.toString() : null,
    quantity: m.quantity.toString(),
    createdAt: m.createdAt,
  }));
}

export async function listProjectEquipment(
  projectId: string,
): Promise<EquipmentRow[]> {
  const rows = await prisma.equipment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((e) => ({
    id: e.id,
    code: e.code,
    name: e.name,
    description: e.description,
    serialNumber: e.serialNumber,
    condition: e.condition,
    unitCost: e.unitCost ? e.unitCost.toString() : null,
    quantity: e.quantity,
    createdAt: e.createdAt,
  }));
}

/**
 * Project lookup for the scan-create form. The form needs a
 * dropdown of all projects in the workspace so the user can
 * pick which project to attach the new inventory item to.
 * Returns just id + name to keep the payload small.
 */
export async function listActiveProjectsForInventory(
  workspaceId: string,
): Promise<Array<{ id: string; name: string; code: string | null }>> {
  return prisma.project.findMany({
    where: { workspaceId, status: { in: ['ACTIVE', 'ON_HOLD'] } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, code: true },
  });
}
