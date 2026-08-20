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
  // Vendor info captured at scan time. We surface it on the
  // project's INVENTORY tab so the foreman can see "where did
  // we get this 2x4 from" at a glance, and we let the user
  // filter the table by vendor.
  vendor: string | null;
  vendorPartNumber: string | null;
  vendorContact: string | null;
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
  vendorFilter?: string | null,
): Promise<MaterialRow[]> {
  const rows = await prisma.material.findMany({
    where: {
      projectId,
      // vendorFilter is the bare string from the URL's
      // ?vendor=… param. Empty string / undefined / null means
      // "no filter". The `mode: 'insensitive'` is intentional
      // — vendors come from manual typing and we don't want
      // a case mismatch to hide a row.
      ...(vendorFilter
        ? { vendor: { equals: vendorFilter, mode: 'insensitive' as const } }
        : {}),
    },
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
    vendor: m.vendor,
    vendorPartNumber: m.vendorPartNumber,
    vendorContact: m.vendorContact,
    createdAt: m.createdAt,
  }));
}

/**
 * Distinct vendor list for the project's INVENTORY tab. Used
 * to populate the "Filter by vendor" dropdown — we want every
 * vendor the project has on file, plus a "Show all" default.
 *
 * We pull from the project's Material rows (not the workspace
 * catalog) because the user thinks in terms of "what vendors
 * did we use on THIS project", not "every vendor we've ever
 * logged anywhere".
 */
export async function listProjectVendors(
  projectId: string,
): Promise<string[]> {
  const rows = await prisma.material.findMany({
    where: { projectId, vendor: { not: null } },
    select: { vendor: true },
    distinct: ['vendor'],
    orderBy: { vendor: 'asc' },
  });
  return rows
    .map((r) => r.vendor)
    .filter((v): v is string => Boolean(v));
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
