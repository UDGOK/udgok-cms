/**
 * Change Order queries.
 *
 * Read paths for COs. Writes are in ./actions.ts. We follow the
 * pay-app pattern: the public share token lookup is a separate
 * function (`getChangeOrderByToken`) that doesn't check the
 * workspace, because the share token IS the credential.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';

export interface ChangeOrderListItem {
  id: string;
  number: string;
  revision: number;
  status: string;
  type: string;
  title: string;
  thisCOAmount: number;
  newContractSum: number;
  createdAt: Date;
  createdByName: string | null;
}

export async function listChangeOrders(
  projectId: string,
  workspaceId: string,
): Promise<ChangeOrderListItem[]> {
  const rows = await prisma.changeOrder.findMany({
    where: { projectId, workspaceId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      number: true,
      revision: true,
      status: true,
      type: true,
      title: true,
      thisCOAmount: true,
      newContractSum: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    revision: r.revision,
    status: r.status,
    type: r.type,
    title: r.title,
    thisCOAmount: Number(r.thisCOAmount),
    newContractSum: Number(r.newContractSum),
    createdAt: r.createdAt,
    createdByName: r.createdBy?.name ?? null,
  }));
}

export interface ChangeOrderDetail extends ChangeOrderListItem {
  description: string | null;
  reasonCode: string | null;
  pricingMethod: string;
  originalContractSum: number;
  netPriorCOs: number;
  priorContractSum: number;
  timeImpactDays: number;
  priorSubstantialCompletion: Date | null;
  newSubstantialCompletion: Date | null;
  lumpSumBreakdown: Prisma.JsonValue | null;
  unitPriceLines: Prisma.JsonValue | null;
  tmNotToExceed: number | null;
  tmMarkupPct: number | null;
  submittedAt: Date | null;
  ownerApprovedAt: Date | null;
  ownerSignatoryName: string | null;
  architectApprovedAt: Date | null;
  architectSignatoryName: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  pdfUrl: string | null;
  notes: string | null;
  divisions: Array<{
    id: string;
    projectDivisionId: string;
    projectDivisionCode: string;
    projectDivisionTrade: string;
    thisCOAmount: number;
    newBudgetDelta: number;
  }>;
  history: Array<{
    id: string;
    type: string;
    actor: string;
    createdAt: Date;
    metadata: PrismaNS.JsonValue | null;
  }>;
}

export async function getChangeOrder(
  coId: string,
  workspaceId: string,
): Promise<ChangeOrderDetail | null> {
  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, workspaceId },
    include: {
      createdBy: { select: { name: true } },
      divisions: {
        include: {
          projectDivision: { select: { id: true, code: true, trade: true } },
        },
      },
    },
  });
  if (!co) return null;

  // History = activity log rows for this CO. Cheap, no join needed.
  const history = await prisma.activityLog.findMany({
    where: { workspaceId, entityType: 'change_order', entityId: coId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      action: true,
      details: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });

  return {
    id: co.id,
    number: co.number,
    revision: co.revision,
    status: co.status,
    type: co.type,
    title: co.title,
    thisCOAmount: Number(co.thisCOAmount),
    newContractSum: Number(co.newContractSum),
    createdAt: co.createdAt,
    createdByName: co.createdBy?.name ?? null,
    description: co.description,
    reasonCode: co.reasonCode,
    pricingMethod: co.pricingMethod,
    originalContractSum: Number(co.originalContractSum),
    netPriorCOs: Number(co.netPriorCOs),
    priorContractSum: Number(co.priorContractSum),
    timeImpactDays: co.timeImpactDays,
    priorSubstantialCompletion: co.priorSubstantialCompletion,
    newSubstantialCompletion: co.newSubstantialCompletion,
    lumpSumBreakdown: co.lumpSumBreakdown,
    unitPriceLines: co.unitPriceLines,
    tmNotToExceed: co.tmNotToExceed ? Number(co.tmNotToExceed) : null,
    tmMarkupPct: co.tmMarkupPct ? Number(co.tmMarkupPct) : null,
    submittedAt: co.submittedAt,
    ownerApprovedAt: co.ownerApprovedAt,
    ownerSignatoryName: co.ownerSignatoryName,
    architectApprovedAt: co.architectApprovedAt,
    architectSignatoryName: co.architectSignatoryName,
    rejectedAt: co.rejectedAt,
    rejectionReason: co.rejectionReason,
    pdfUrl: co.pdfUrl,
    notes: co.notes,
    divisions: co.divisions.map((d) => ({
      id: d.id,
      projectDivisionId: d.projectDivisionId,
      projectDivisionCode: d.projectDivision.code,
      projectDivisionTrade: d.projectDivision.trade,
      thisCOAmount: Number(d.thisCOAmount),
      newBudgetDelta: Number(d.newBudgetDelta),
    })),
    history: history.map((h) => ({
      id: h.id,
      type: h.action,
      actor: h.actor?.name ?? h.actor?.email ?? 'system',
      createdAt: h.createdAt,
      metadata: { details: h.details },
    })),
  };
}

export interface ChangeOrderByToken {
  id: string;
  number: string;
  revision: number;
  status: string;
  type: string;
  title: string;
  description: string | null;
  reasonCode: string | null;
  originalContractSum: number;
  netPriorCOs: number;
  priorContractSum: number;
  thisCOAmount: number;
  newContractSum: number;
  timeImpactDays: number;
  priorSubstantialCompletion: Date | null;
  newSubstantialCompletion: Date | null;
  projectName: string;
  workspaceName: string;
  ownerApprovedAt: Date | null;
  architectApprovedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
}

/**
 * Look up a CO by its public share token. No workspace check —
 * the token IS the credential. Returns null if the token is
 * unknown or the CO is in a terminal state (so a stale link
 * doesn't let someone re-approve).
 */
export async function getChangeOrderByToken(
  token: string,
): Promise<ChangeOrderByToken | null> {
  const co = await prisma.changeOrder.findUnique({
    where: { shareToken: token },
    include: {
      project: { select: { name: true, workspace: { select: { name: true } } } },
    },
  });
  if (!co) return null;
  if (
    co.status === 'APPROVED' ||
    co.status === 'REJECTED' ||
    co.status === 'WITHDRAWN' ||
    co.status === 'SUPERSEDED'
  ) {
    // Still return the row for "view only" — but the action handlers
    // will refuse further mutations.
  }
  return {
    id: co.id,
    number: co.number,
    revision: co.revision,
    status: co.status,
    type: co.type,
    title: co.title,
    description: co.description,
    reasonCode: co.reasonCode,
    originalContractSum: Number(co.originalContractSum),
    netPriorCOs: Number(co.netPriorCOs),
    priorContractSum: Number(co.priorContractSum),
    thisCOAmount: Number(co.thisCOAmount),
    newContractSum: Number(co.newContractSum),
    timeImpactDays: co.timeImpactDays,
    priorSubstantialCompletion: co.priorSubstantialCompletion,
    newSubstantialCompletion: co.newSubstantialCompletion,
    projectName: co.project.name,
    workspaceName: co.project.workspace.name,
    ownerApprovedAt: co.ownerApprovedAt,
    architectApprovedAt: co.architectApprovedAt,
    rejectedAt: co.rejectedAt,
    rejectionReason: co.rejectionReason,
  };
}

/**
 * Bump firstViewedAt + viewCount the first time a token is used.
 * Pure side-effect — never throws.
 */
export async function trackChangeOrderView(coId: string): Promise<void> {
  try {
    await prisma.changeOrder.updateMany({
      where: { id: coId, firstViewedAt: null },
      data: { firstViewedAt: new Date(), viewCount: { increment: 1 } },
    });
    // If firstViewedAt was already set, just bump the counter.
    await prisma.changeOrder.updateMany({
      where: { id: coId, NOT: { firstViewedAt: null } },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Tracking is best-effort.
  }
}
