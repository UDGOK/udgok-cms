/**
 * Submittal + RFI queries.
 *
 * Read paths for the spec-section submittal log and the
 * formal RFI register. Public-token lookups are separate
 * (no workspace check) because the token IS the credential.
 */

import { prisma } from '@/lib/db/client';

// ============================================================================
// Submittals
// ============================================================================

export interface SubmittalListItem {
  id: string;
  number: string;
  specSection: string;
  specSequence: number;
  revision: number;
  title: string;
  status: string;
  disposition: string | null;
  submittedAt: Date | null;
  requiredByDate: Date | null;
  subcontractorName: string | null;
  createdAt: Date;
}

export async function listSubmittals(
  projectId: string,
  workspaceId: string,
): Promise<SubmittalListItem[]> {
  const rows = await prisma.submittal.findMany({
    where: { projectId, workspaceId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      number: true,
      specSection: true,
      specSequence: true,
      revision: true,
      title: true,
      status: true,
      disposition: true,
      submittedAt: true,
      requiredByDate: true,
      subcontractor: { select: { name: true } },
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    specSection: r.specSection,
    specSequence: r.specSequence,
    revision: r.revision,
    title: r.title,
    status: r.status,
    disposition: r.disposition,
    submittedAt: r.submittedAt,
    requiredByDate: r.requiredByDate,
    subcontractorName: r.subcontractor?.name ?? null,
    createdAt: r.createdAt,
  }));
}

export async function getSubmittal(id: string, workspaceId: string) {
  const s = await prisma.submittal.findFirst({
    where: { id, workspaceId },
    include: {
      project: { select: { name: true, workspace: { select: { name: true } } } },
      subcontractor: { select: { name: true } },
      files: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!s) return null;
  return s;
}

export interface SubmittalByToken {
  id: string;
  number: string;
  specSection: string;
  specSequence: number;
  revision: number;
  title: string;
  description: string | null;
  status: string;
  disposition: string | null;
  projectName: string;
  workspaceName: string;
  subcontractorName: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  files: Array<{ id: string; url: string; filename: string }>;
}

export async function getSubmittalByToken(token: string): Promise<SubmittalByToken | null> {
  const s = await prisma.submittal.findUnique({
    where: { shareToken: token },
    include: {
      project: { select: { name: true, workspace: { select: { name: true } } } },
      subcontractor: { select: { name: true } },
      files: { select: { id: true, url: true, filename: true } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    number: s.number,
    specSection: s.specSection,
    specSequence: s.specSequence,
    revision: s.revision,
    title: s.title,
    description: s.description,
    status: s.status,
    disposition: s.disposition,
    projectName: s.project.name,
    workspaceName: s.project.workspace.name,
    subcontractorName: s.subcontractor?.name ?? null,
    submittedAt: s.submittedAt,
    reviewedAt: s.reviewedAt,
    reviewNotes: s.reviewNotes,
    files: s.files,
  };
}

export async function trackSubmittalView(id: string): Promise<void> {
  try {
    await prisma.submittal.updateMany({
      where: { id, firstViewedAt: null },
      data: { firstViewedAt: new Date(), viewCount: { increment: 1 } },
    });
    await prisma.submittal.updateMany({
      where: { id, NOT: { firstViewedAt: null } },
      data: { viewCount: { increment: 1 } },
    });
  } catch { /* best-effort */ }
}

// ============================================================================
// RFIs
// ============================================================================

export interface RfiListItem {
  id: string;
  number: string;
  revision: number;
  subject: string;
  status: string;
  costImpact: boolean;
  scheduleImpact: boolean;
  submittedAt: Date | null;
  answeredAt: Date | null;
  dueDate: Date | null;
  createdByName: string | null;
  createdAt: Date;
}

export async function listRfis(projectId: string, workspaceId: string): Promise<RfiListItem[]> {
  const rows = await prisma.rfi.findMany({
    where: { projectId, workspaceId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      number: true,
      revision: true,
      subject: true,
      status: true,
      costImpact: true,
      scheduleImpact: true,
      submittedAt: true,
      answeredAt: true,
      dueDate: true,
      createdBy: { select: { name: true } },
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    revision: r.revision,
    subject: r.subject,
    status: r.status,
    costImpact: r.costImpact,
    scheduleImpact: r.scheduleImpact,
    submittedAt: r.submittedAt,
    answeredAt: r.answeredAt,
    dueDate: r.dueDate,
    createdByName: r.createdBy?.name ?? null,
    createdAt: r.createdAt,
  }));
}

export async function getRfi(id: string, workspaceId: string) {
  const r = await prisma.rfi.findFirst({
    where: { id, workspaceId },
    include: {
      project: { select: { name: true, workspace: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      triggeredSubmittals: { select: { id: true, number: true, title: true } },
    },
  });
  if (!r) return null;
  return r;
}

export interface RfiByToken {
  id: string;
  number: string;
  revision: number;
  subject: string;
  question: string;
  answer: string | null;
  status: string;
  costImpact: boolean;
  costImpactAmount: number | null;
  costImpactNote: string | null;
  scheduleImpact: boolean;
  scheduleImpactDays: number;
  projectName: string;
  workspaceName: string;
  submittedAt: Date | null;
  dueDate: Date | null;
  answeredAt: Date | null;
}

export async function getRfiByToken(token: string): Promise<RfiByToken | null> {
  const r = await prisma.rfi.findUnique({
    where: { shareToken: token },
    include: {
      project: { select: { name: true, workspace: { select: { name: true } } } },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    number: r.number,
    revision: r.revision,
    subject: r.subject,
    question: r.question,
    answer: r.answer,
    status: r.status,
    costImpact: r.costImpact,
    costImpactAmount: r.costImpactAmount ? Number(r.costImpactAmount) : null,
    costImpactNote: r.costImpactNote,
    scheduleImpact: r.scheduleImpact,
    scheduleImpactDays: r.scheduleImpactDays,
    projectName: r.project.name,
    workspaceName: r.project.workspace.name,
    submittedAt: r.submittedAt,
    dueDate: r.dueDate,
    answeredAt: r.answeredAt,
  };
}

export async function trackRfiView(id: string): Promise<void> {
  try {
    await prisma.rfi.updateMany({
      where: { id, firstViewedAt: null },
      data: { firstViewedAt: new Date(), viewCount: { increment: 1 } },
    });
    await prisma.rfi.updateMany({
      where: { id, NOT: { firstViewedAt: null } },
      data: { viewCount: { increment: 1 } },
    });
  } catch { /* best-effort */ }
}
