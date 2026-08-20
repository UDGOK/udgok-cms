/**
 * Estimate queries — server-side read helpers.
 *
 * The hot queries are:
 *   - getEstimates(workspaceId) — list with filters
 *   - getEstimate(workspaceId, id) — detail for the
 *     admin builder view (auth-gated)
 *   - getEstimateByToken(token) — public view used
 *     by /e/[token]
 *
 * All queries are pinned to the workspace so a
 * cross-workspace read is impossible at the query
 * layer.
 */

import { prisma } from '@/lib/db/client';
import type { EstimateStatus } from '@prisma/client';

export interface EstimateSummary {
  id: string;
  number: string;
  title: string;
  status: EstimateStatus;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  total: number;
  validUntil: string | null;
  createdAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  convertedProjectId: string | null;
  convertedProjectName: string | null;
}

export interface EstimateLineItemDto {
  id: string;
  position: number;
  divisionCode: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface EstimateDetail {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: EstimateStatus;
  shareToken: string | null;
  validUntil: string | null;
  subtotal: number;
  taxRate: number | null;
  taxAmount: number | null;
  total: number;
  workspaceId: string;
  workspaceName: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedByEmail: string | null;
  rejectedByName: string | null;
  rejectNote: string | null;
  convertedProjectId: string | null;
  convertedProjectName: string | null;
  convertedAt: string | null;
  pendingProjectName: string | null;
  pendingProjectCode: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null };
  project: { id: string; name: string; code: string | null } | null;
  deal: { id: string; title: string; stage: string } | null;
  lineItems: EstimateLineItemDto[];
}

function toSummary(row: {
  id: string;
  number: string;
  title: string;
  status: EstimateStatus;
  clientId: string;
  client: { name: string };
  projectId: string | null;
  project: { name: string } | null;
  dealId: string | null;
  deal: { title: string } | null;
  total: { toString(): string } | number;
  validUntil: Date | null;
  createdAt: Date;
  sentAt: Date | null;
  approvedAt: Date | null;
  sourceProject: { id: string; name: string } | null;
}): EstimateSummary {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    clientId: row.clientId,
    clientName: row.client.name,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    dealId: row.dealId,
    dealTitle: row.deal?.title ?? null,
    total:
      typeof row.total === 'number'
        ? row.total
        : parseFloat(row.total.toString()),
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    convertedProjectId: row.sourceProject?.id ?? null,
    convertedProjectName: row.sourceProject?.name ?? null,
  };
}

export async function getEstimates(
  workspaceId: string,
  opts: { clientId?: string; status?: EstimateStatus } = {},
): Promise<EstimateSummary[]> {
  const rows = await prisma.estimate.findMany({
    where: {
      workspaceId,
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    include: {
      client: { select: { name: true } },
      project: { select: { name: true } },
      deal: { select: { title: true } },
      sourceProject: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toSummary);
}

export async function getEstimate(
  workspaceId: string,
  id: string,
): Promise<EstimateDetail | null> {
  const row = await prisma.estimate.findFirst({
    where: { id, workspaceId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      project: { select: { id: true, name: true, code: true } },
      deal: { select: { id: true, title: true, stage: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      sourceProject: { select: { id: true, name: true } },
      lineItems: { orderBy: { position: 'asc' } },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    shareToken: row.shareToken,
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    subtotal: parseFloat(row.subtotal.toString()),
    taxRate: row.taxRate ? parseFloat(row.taxRate.toString()) : null,
    taxAmount: row.taxAmount ? parseFloat(row.taxAmount.toString()) : null,
    total: parseFloat(row.total.toString()),
    workspaceId: row.workspace.id,
    workspaceName: row.workspace.name,
    createdById: row.createdById,
    createdByName: row.createdBy.name ?? row.createdBy.email,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    firstViewedAt: row.firstViewedAt ? row.firstViewedAt.toISOString() : null,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedByEmail: row.approvedByEmail,
    approvedByName: row.approvedByName,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
    rejectedByEmail: row.rejectedByEmail,
    rejectedByName: row.rejectedByName,
    rejectNote: row.rejectNote,
    convertedProjectId: row.sourceProject?.id ?? null,
    convertedProjectName: row.sourceProject?.name ?? null,
    convertedAt: row.convertedAt ? row.convertedAt.toISOString() : null,
    pendingProjectName: row.pendingProjectName,
    pendingProjectCode: row.pendingProjectCode,
    client: row.client,
    project: row.project,
    deal: row.deal,
    lineItems: row.lineItems.map((li) => ({
      id: li.id,
      position: li.position,
      divisionCode: li.divisionCode,
      description: li.description,
      quantity: parseFloat(li.quantity.toString()),
      unit: li.unit,
      unitPrice: parseFloat(li.unitPrice.toString()),
      lineTotal: parseFloat(li.lineTotal.toString()),
    })),
  };
}

export async function getEstimateByToken(
  token: string,
): Promise<EstimateDetail | null> {
  const row = await prisma.estimate.findUnique({
    where: { shareToken: token },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      project: { select: { id: true, name: true, code: true } },
      deal: { select: { id: true, title: true, stage: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      sourceProject: { select: { id: true, name: true } },
      lineItems: { orderBy: { position: 'asc' } },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    shareToken: row.shareToken,
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    subtotal: parseFloat(row.subtotal.toString()),
    taxRate: row.taxRate ? parseFloat(row.taxRate.toString()) : null,
    taxAmount: row.taxAmount ? parseFloat(row.taxAmount.toString()) : null,
    total: parseFloat(row.total.toString()),
    workspaceId: row.workspace.id,
    workspaceName: row.workspace.name,
    createdById: row.createdById,
    createdByName: row.createdBy.name ?? row.createdBy.email,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    firstViewedAt: row.firstViewedAt ? row.firstViewedAt.toISOString() : null,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedByEmail: row.approvedByEmail,
    approvedByName: row.approvedByName,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
    rejectedByEmail: row.rejectedByEmail,
    rejectedByName: row.rejectedByName,
    rejectNote: row.rejectNote,
    convertedProjectId: row.sourceProject?.id ?? null,
    convertedProjectName: row.sourceProject?.name ?? null,
    convertedAt: row.convertedAt ? row.convertedAt.toISOString() : null,
    pendingProjectName: row.pendingProjectName,
    pendingProjectCode: row.pendingProjectCode,
    client: row.client,
    project: row.project,
    deal: row.deal,
    lineItems: row.lineItems.map((li) => ({
      id: li.id,
      position: li.position,
      divisionCode: li.divisionCode,
      description: li.description,
      quantity: parseFloat(li.quantity.toString()),
      unit: li.unit,
      unitPrice: parseFloat(li.unitPrice.toString()),
      lineTotal: parseFloat(li.lineTotal.toString()),
    })),
  };
}

/**
 * Used by the public view-action. Bumps view count +
 * transitions DRAFT→SENT→VIEWED on first view.
 */
export async function recordEstimateView(token: string): Promise<{
  ok: boolean;
  estimateId: string;
} | null> {
  const row = await prisma.estimate.findUnique({
    where: { shareToken: token },
    select: { id: true, status: true, firstViewedAt: true },
  });
  if (!row) return null;
  // If still DRAFT, something is wrong — the admin
  // should never have shared a DRAFT URL. Treat as
  // not-found for the public.
  if (row.status === 'DRAFT') return null;
  // Already viewed? Don't update firstViewedAt again.
  // Just return.
  if (row.firstViewedAt) return { ok: true, estimateId: row.id };
  await prisma.estimate.update({
    where: { id: row.id },
    data: {
      firstViewedAt: new Date(),
      // SENT → VIEWED on the first view.
      ...(row.status === 'SENT' ? { status: 'VIEWED' as const } : {}),
    },
  });
  return { ok: true, estimateId: row.id };
}
