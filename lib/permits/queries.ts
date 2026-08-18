import { prisma } from '@/lib/db/client';

export const PERMIT_STATUS_LABELS: Record<string, string> = {
  NOT_APPLIED: 'Not applied',
  APPLIED: 'Applied',
  ISSUED: 'Issued',
  INSPECTION_SCHEDULED: 'Inspection scheduled',
  PASSED: 'Passed',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const PERMIT_STATUS_COLORS: Record<string, string> = {
  NOT_APPLIED: 'bg-line text-ink-50',
  APPLIED: 'bg-warning text-ink',
  ISSUED: 'bg-success text-paper',
  INSPECTION_SCHEDULED: 'bg-orange text-paper',
  PASSED: 'bg-success text-paper',
  FAILED: 'bg-error text-paper',
  EXPIRED: 'bg-error text-paper',
  CANCELLED: 'bg-ink-30 text-ink',
};

export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  FOOTING: 'Footing',
  FOUNDATION: 'Foundation',
  SLAB: 'Slab',
  FRAMING: 'Framing',
  SHEATHING: 'Sheathing',
  ROUGH_PLUMBING: 'Rough plumbing',
  ROUGH_ELECTRICAL: 'Rough electrical',
  ROUGH_MECHANICAL: 'Rough mechanical',
  ROUGH_GAS: 'Rough gas',
  INSULATION: 'Insulation',
  DRYWALL: 'Drywall',
  ROOFING: 'Roofing',
  WINDOW: 'Window',
  SIDING: 'Siding',
  FINAL_PLUMBING: 'Final plumbing',
  FINAL_ELECTRICAL: 'Final electrical',
  FINAL_MECHANICAL: 'Final mechanical',
  FINAL_BUILDING: 'Final building',
  FIRE: 'Fire',
  UTILITY: 'Utility',
  CUSTOM: 'Custom',
};

export const INSPECTION_RESULT_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PASSED: 'Passed',
  FAILED: 'Failed',
  PARTIAL: 'Partial',
  CANCELLED: 'Cancelled',
};

export const INSPECTION_RESULT_COLORS: Record<string, string> = {
  PENDING: 'bg-warning text-ink',
  PASSED: 'bg-success text-paper',
  FAILED: 'bg-error text-paper',
  PARTIAL: 'bg-orange text-paper',
  CANCELLED: 'bg-ink-30 text-ink',
};

export async function listProjectPermits(projectId: string) {
  return prisma.permit.findMany({
    where: { projectId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      inspections: {
        orderBy: { scheduledDate: 'asc' },
      },
    },
  });
}

export async function getPermit(id: string) {
  return prisma.permit.findUnique({
    where: { id },
    include: {
      inspections: { orderBy: { scheduledDate: 'asc' } },
      project: { select: { id: true, name: true, workspaceId: true } },
    },
  });
}

export interface PermitSummary {
  total: number;
  issued: number;
  pending: number;
  passed: number;
  failed: number;
  upcomingInspections: number;
  overdueInspections: number;
}

export function summarizePermits(
  permits: { status: string; inspections: { result: string; scheduledDate: Date | null }[] }[],
): PermitSummary {
  const upcomingInspections = permits
    .flatMap((p) => p.inspections)
    .filter(
      (i) =>
        i.result === 'PENDING' &&
        i.scheduledDate &&
        i.scheduledDate.getTime() > Date.now(),
    ).length;
  const overdueInspections = permits
    .flatMap((p) => p.inspections)
    .filter(
      (i) =>
        i.result === 'PENDING' &&
        i.scheduledDate &&
        i.scheduledDate.getTime() < Date.now(),
    ).length;

  return {
    total: permits.length,
    issued: permits.filter((p) => p.status === 'ISSUED').length,
    pending: permits.filter(
      (p) => p.status === 'APPLIED' || p.status === 'NOT_APPLIED',
    ).length,
    passed: permits.filter((p) => p.status === 'PASSED').length,
    failed: permits.filter((p) => p.status === 'FAILED').length,
    upcomingInspections,
    overdueInspections,
  };
}
