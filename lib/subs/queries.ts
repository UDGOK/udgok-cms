import { prisma } from '@/lib/db/client';

export interface SubcontractorListItem {
  id: string;
  name: string;
  primaryTrade: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  licenseNumber: string | null;
  insuranceExpiry: Date | null;
  w9OnFile: boolean;
  rating: number | null;
  projectCount: number;
  totalContract: number;
}

export async function listSubcontractors(workspaceId: string): Promise<SubcontractorListItem[]> {
  const subs = await prisma.subcontractor.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
    include: {
      assignments: {
        select: { contractAmount: true, status: true, projectId: true },
      },
    },
  });
  return subs.map((s) => ({
    id: s.id,
    name: s.name,
    primaryTrade: s.primaryTrade,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    licenseNumber: s.licenseNumber,
    insuranceExpiry: s.insuranceExpiry,
    w9OnFile: s.w9OnFile,
    rating: s.rating,
    projectCount: new Set(s.assignments.map((a) => a.projectId).filter(Boolean)).size,
    totalContract: s.assignments
      .filter((a) => a.status !== 'CANCELLED')
      .reduce((acc, a) => acc + Number(a.contractAmount), 0),
  }));
}

export interface SubcontractorDetail {
  id: string;
  name: string;
  primaryTrade: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  licenseNumber: string | null;
  insuranceExpiry: Date | null;
  w9OnFile: boolean;
  hourlyRate: number | null;
  notes: string | null;
  rating: number | null;
  createdAt: Date;
  assignments: Array<{
    id: string;
    contractAmount: number;
    status: string;
    notes: string | null;
    projectId: string;
    projectName: string;
    divisions: Array<{ divisionId: string; code: string; trade: string; amount: number }>;
  }>;
}

export async function getSubcontractor(workspaceId: string, id: string): Promise<SubcontractorDetail | null> {
  const sub = await prisma.subcontractor.findFirst({
    where: { id, workspaceId },
    include: {
      assignments: {
        include: {
          project: { select: { id: true, name: true } },
          divisionLinks: {
            include: { division: { select: { id: true, code: true, trade: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!sub) return null;
  return {
    id: sub.id,
    name: sub.name,
    primaryTrade: sub.primaryTrade,
    contactName: sub.contactName,
    contactEmail: sub.contactEmail,
    contactPhone: sub.contactPhone,
    address: sub.address,
    licenseNumber: sub.licenseNumber,
    insuranceExpiry: sub.insuranceExpiry,
    w9OnFile: sub.w9OnFile,
    hourlyRate: sub.hourlyRate ? Number(sub.hourlyRate) : null,
    notes: sub.notes,
    rating: sub.rating,
    createdAt: sub.createdAt,
    assignments: sub.assignments.map((a) => ({
      id: a.id,
      contractAmount: Number(a.contractAmount),
      status: a.status,
      notes: a.notes,
      projectId: a.project.id,
      projectName: a.project.name,
      divisions: a.divisionLinks.map((dl) => ({
        divisionId: dl.division.id,
        code: dl.division.code,
        trade: dl.division.trade,
        amount: Number(dl.amount),
      })),
    })),
  };
}
