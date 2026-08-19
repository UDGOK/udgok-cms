/**
 * Adapter — turn a Prisma project + the route's computed
 * completion into a ProjectData that the PDF can consume.
 *
 * The PDF is read-only; we don't write anything here. We just
 * narrow the type and pick the fields each section needs.
 *
 * Photos are capped to the 60 most-recent to keep the file
 * size sane. The `totalPhotos` field on the result preserves the
 * true count so the PDF can show "Showing 60 of N".
 */

import type { ProjectData } from './types';
import { computeProjectCompletion } from '@/lib/projects/insights';

const MAX_PHOTOS = 60;

export interface PrismaProjectForPdf {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  contractValue: { toString(): string } | number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodedAt: Date | null;
  geocodeSource: string | null;
  geocodedAddress: string | null;
  client: { id: string; name: string } | null;
  members: Array<{
    userId: string;
    role: string | null;
    user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  }>;
  divisions: Array<{
    id: string;
    code: string;
    trade: string;
    budget: { toString(): string } | number;
    subcontractorName: string | null;
    subLinks: {
      assignment: { subcontractor: { id: string; name: string } };
    }[];
    payAppLines: { thisDrawAmount: { toString(): string } | number }[];
  }>;
  payApps: Array<{
    id: string;
    drawNumber: number;
    status: string;
    totalContract: { toString(): string } | number;
    totalPrevious: { toString(): string } | number;
    totalThisDraw: { toString(): string } | number;
    periodStart: Date;
    periodEnd: Date;
    createdAt: Date;
    acknowledgedByEmail?: string | null;
    acknowledgedByName?: string | null;
    acknowledgedAt?: Date | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    assignee: { id: string; name: string | null; avatarUrl: string | null } | null;
  }>;
  subAssignments: Array<{
    id: string;
    status: string;
    createdAt: Date;
    subcontractor: { id: string; name: string; primaryTrade: string | null };
    divisionLinks: { division: { id: string; code: string; trade: string } }[];
  }>;
  // Permits and notes + activity are fetched separately by the
  // route handler and passed in as a "context" object.
}

export interface PdfContextExtras {
  permits: Array<{
    id: string;
    permitNumber: string | null;
    type: string;
    status: string;
    jurisdiction: string | null;
    appliedDate: Date | null;
    issuedDate: Date | null;
    expirationDate: Date | null;
    fee: { toString(): string } | number | null;
    notes: string | null;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: Date;
    user: { name: string | null; email: string };
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityName: string | null;
    details: string | null;
    createdAt: Date;
    actor: { name: string | null; email: string } | null;
  }>;
  photos: Array<{
    id: string;
    url: string;
    filename: string;
    phase: string;
    room: string | null;
    area: string | null;
    caption: string | null;
    latitude: number | null;
    longitude: number | null;
    takenAt: Date | null;
    uploader: { name: string | null; email: string };
  }>;
}

export function toProjectData(
  prisma: PrismaProjectForPdf,
  ctx: PdfContextExtras,
): ProjectData {
  // The completion computation lives in lib/projects/insights.ts
  // and takes a projectMeta shape that's a subset of the
  // Prisma result. We feed it the relevant fields.
  const projectMeta = {
    id: prisma.id,
    name: prisma.name,
    status: prisma.status,
    startDate: prisma.startDate,
    endDate: prisma.endDate,
    contractValue: prisma.contractValue ? Number(prisma.contractValue) : null,
    divisions: prisma.divisions.map((d) => ({
      id: d.id,
      budget: Number(d.budget),
      payAppLines: d.payAppLines.map((l) => ({ thisDrawAmount: Number(l.thisDrawAmount) })),
    })),
    payApps: prisma.payApps.map((p) => ({
      id: p.id,
      status: p.status,
      totalThisDraw: Number(p.totalThisDraw),
      totalContract: Number(p.totalContract),
      totalPrevious: Number(p.totalPrevious),
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      createdAt: p.createdAt,
      divisions: [], // not used by completion calc
    })),
    tasks: prisma.tasks.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      startDate: t.startDate,
      endDate: t.endDate,
      title: t.title,
      assignee: t.assignee ? { name: t.assignee.name } : null,
    })),
    subAssignments: prisma.subAssignments.map((a) => ({ status: a.status })),
  };
  const completion = computeProjectCompletion(projectMeta);

  // Photos: most-recent first, capped at MAX_PHOTOS.
  const sortedPhotos = [...ctx.photos].sort((a, b) => {
    const at = a.takenAt?.getTime() ?? a.takenAt ? new Date(a.takenAt as unknown as string).getTime() : 0;
    const bt = b.takenAt?.getTime() ?? b.takenAt ? new Date(b.takenAt as unknown as string).getTime() : 0;
    return bt - at;
  });
  const photos = sortedPhotos.slice(0, MAX_PHOTOS).map((p) => ({
    id: p.id,
    url: p.url,
    filename: p.filename,
    phase: p.phase,
    room: p.room,
    area: p.area,
    caption: p.caption,
    latitude: p.latitude,
    longitude: p.longitude,
    takenAt: p.takenAt,
    uploader: p.uploader,
  }));

  return {
    id: prisma.id,
    name: prisma.name,
    code: prisma.code,
    description: prisma.description,
    status: prisma.status,
    startDate: prisma.startDate,
    endDate: prisma.endDate,
    contractValue: prisma.contractValue,
    address: prisma.address,
    city: prisma.city,
    state: prisma.state,
    zip: prisma.zip,
    latitude: prisma.latitude,
    longitude: prisma.longitude,
    geocodedAt: prisma.geocodedAt,
    geocodeSource: prisma.geocodeSource,
    geocodedAddress: prisma.geocodedAddress,
    client: prisma.client,
    members: prisma.members,
    divisions: prisma.divisions,
    payApps: prisma.payApps,
    tasks: prisma.tasks,
    subAssignments: prisma.subAssignments,
    permits: ctx.permits,
    notes: ctx.notes,
    activity: ctx.activity,
    totalPhotos: ctx.photos.length,
    photos,
    completion,
  };
}
