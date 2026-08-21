/**
 * Financial summary queries for a single project.
 *
 * The project page's "Financials" tab + the embedded
 * FinancialSummary card both pull from this single
 * source. We compute it in one pass so the page doesn't
 * fan out into a dozen sequential Prisma calls.
 *
 * What's here:
 *
 *  1. AR (Accounts Receivable — money owed TO you)
 *     - All pay apps grouped by status (draft / sent /
 *       viewed / acknowledged / paid / disputed /
 *       superseded)
 *     - Outstanding receivables (sent/viewed/acknowledged
 *       not yet paid) with days outstanding
 *     - Last 5 pay apps in chronological order
 *
 *  2. AP (Accounts Payable — money you owe OTHERS)
 *     - All POs on this project grouped by status
 *     - Open POs (issued, acknowledged, partially received)
 *     - Total committed (open PO $)
 *     - Vendor invoices grouped by status (submitted /
 *       approved / paid)
 *     - Pending invoice $ (submitted, not yet approved)
 *     - Approved-but-unpaid invoice $ (waiting to be paid)
 *
 *  3. Cost summary
 *     - Sum of sub contract amounts (PSA.contractAmount)
 *     - Sum of division budgets
 *     - Estimated gross margin = contractValue - subContractTotal
 *
 * All amounts are returned as `number` (not `Decimal`) so
 * React + JSON serialization don't need special handling.
 * The Decimal → number conversion is done in the helper.
 */

import { prisma } from '@/lib/db/client';
import type { PayAppStatus, PoStatus, PoInvoiceStatus } from '@prisma/client';

export interface ProjectFinancialSummary {
  projectId: string;

  // Top-line
  contractValue: number;
  totalBilled: number;       // sum of all pay apps that left the door (SENT or beyond)
  totalPaid: number;         // sum of PAID pay apps only
  totalReceived: number;     // alias for totalBilled (legacy name)
  outstandingAr: number;     // SENT + VIEWED + ACKNOWLEDGED (not yet PAID)
  balanceToBill: number;     // contractValue - totalBilled
  percentBilled: number;     // 0-100
  estimatedMargin: number;   // contractValue - subContractTotal
  estimatedMarginPct: number;

  // Sub costs
  totalSubContractAmount: number;
  totalDivisionBudget: number;

  // Pay app breakdown
  payAppCounts: Record<PayAppStatus, number>;
  payAppAmountsByStatus: Record<PayAppStatus, number>;
  recentPayApps: PayAppRow[];

  // Outstanding receivables — pay apps in SENT/VIEWED/ACKNOWLEDGED, not yet PAID
  outstandingReceivables: OutstandingAR[];

  // PO / AP breakdown
  poCounts: Record<PoStatus, number>;
  poOpenTotal: number;       // ISSUED + ACKNOWLEDGED + PARTIALLY_RECEIVED
  poCommittedTotal: number;  // all non-cancelled POs

  // Invoices
  invoiceCounts: Record<PoInvoiceStatus, number>;
  invoicePendingApproval: number;  // submitted, not yet approved
  invoiceApprovedUnpaid: number;   // approved, not yet paid
  invoiceTotalPaid: number;
  recentInvoices: InvoiceRow[];

  // Subs
  subCount: number;
}

export interface PayAppRow {
  id: string;
  drawNumber: number;
  status: PayAppStatus;
  totalThisDraw: number;
  totalContract: number;
  totalPrevious: number;
  totalBalance: number;
  periodStart: Date;
  periodEnd: Date;
  sentAt: Date | null;
  acknowledgedAt: Date | null;
  firstViewedAt: Date | null;
  pdfUrl: string | null;
}

export interface OutstandingAR extends PayAppRow {
  daysSinceSent: number;
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceAmount: number;
  status: PoInvoiceStatus;
  poNumber: string;
  vendorName: string;
  receivedAt: Date;
}

const PAY_APP_STATUSES: PayAppStatus[] = [
  'DRAFT', 'SENT', 'VIEWED', 'ACKNOWLEDGED', 'PAID', 'DISPUTED', 'SUPERSEDED',
];

const PO_STATUSES: PoStatus[] = [
  'DRAFT', 'PENDING_APPROVAL', 'ISSUED', 'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED',
];

const INVOICE_STATUSES: PoInvoiceStatus[] = [
  'SUBMITTED', 'APPROVED', 'DISPUTED', 'PAID', 'VOID',
];

function num(x: unknown): number {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  // Prisma Decimal — has toString() that returns a plain decimal
  if (typeof (x as { toString?: () => string }).toString === 'function') {
    const n = Number((x as { toString: () => string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function zeroMap<T extends string>(keys: T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const k of keys) out[k] = 0;
  return out;
}

/**
 * Build a comprehensive financial summary for a single project.
 *
 * This is intentionally one call (with one Prisma round-trip
 * batch) so the financial tab renders without waterfalling
 * queries. Most production projects will have < 50 pay apps
 * and < 100 POs, so the size is bounded.
 */
export async function getProjectFinancialSummary(
  projectId: string,
): Promise<ProjectFinancialSummary> {
  const [
    project,
    payApps,
    purchaseOrders,
    subAssignments,
    divisionBudget,
    recentInvoices,
  ] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, contractValue: true },
    }),
    prisma.payApp.findMany({
      where: { projectId },
      orderBy: [{ drawNumber: 'desc' }],
      include: {
        divisions: {
          select: { projectDivisionId: true, thisDrawAmount: true },
        },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { projectId },
      select: { id: true, status: true, total: true, number: true },
    }),
    prisma.projectSubcontractorAssignment.findMany({
      where: { projectId },
      select: { contractAmount: true },
    }),
    prisma.projectDivision.aggregate({
      where: { projectId },
      _sum: { budget: true },
    }),
    prisma.poInvoice.findMany({
      where: { po: { projectId } },
      orderBy: { receivedAt: 'desc' },
      take: 8,
      include: {
        po: {
          select: {
            number: true,
            vendor: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const contractValue = num(project.contractValue);

  // -- Pay app rollup --
  const payAppCounts = zeroMap(PAY_APP_STATUSES);
  const payAppAmountsByStatus = zeroMap(PAY_APP_STATUSES);
  let totalBilled = 0;
  let totalPaid = 0;

  for (const p of payApps) {
    payAppCounts[p.status] += 1;
    const amt = num(p.totalThisDraw);
    payAppAmountsByStatus[p.status] += amt;
    if (p.status === 'PAID') {
      totalPaid += amt;
      totalBilled += amt;
    } else if (p.status !== 'DRAFT' && p.status !== 'SUPERSEDED') {
      // Anything actually sent downstream — SENT, VIEWED, ACKNOWLEDGED, DISPUTED
      totalBilled += amt;
    }
  }

  const outstandingAr =
    payAppAmountsByStatus.SENT +
    payAppAmountsByStatus.VIEWED +
    payAppAmountsByStatus.ACKNOWLEDGED;

  // -- Outstanding receivables (with days) --
  const now = Date.now();
  const outstandingReceivables: OutstandingAR[] = payApps
    .filter((p) => p.status === 'SENT' || p.status === 'VIEWED' || p.status === 'ACKNOWLEDGED')
    .map((p) => {
      const sentAt = p.sentAt ?? p.firstViewedAt ?? p.periodEnd;
      const days = Math.max(
        0,
        Math.floor((now - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24)),
      );
      return {
        id: p.id,
        drawNumber: p.drawNumber,
        status: p.status,
        totalThisDraw: num(p.totalThisDraw),
        totalContract: num(p.totalContract),
        totalPrevious: num(p.totalPrevious),
        totalBalance: num(p.totalBalance),
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        sentAt: p.sentAt,
        acknowledgedAt: p.acknowledgedAt,
        firstViewedAt: p.firstViewedAt,
        pdfUrl: p.pdfUrl,
        daysSinceSent: days,
      };
    })
    .sort((a, b) => b.daysSinceSent - a.daysSinceSent);

  // -- Recent pay apps (last 5) --
  const recentPayApps: PayAppRow[] = payApps.slice(0, 5).map((p) => ({
    id: p.id,
    drawNumber: p.drawNumber,
    status: p.status,
    totalThisDraw: num(p.totalThisDraw),
    totalContract: num(p.totalContract),
    totalPrevious: num(p.totalPrevious),
    totalBalance: num(p.totalBalance),
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    sentAt: p.sentAt,
    acknowledgedAt: p.acknowledgedAt,
    firstViewedAt: p.firstViewedAt,
    pdfUrl: p.pdfUrl,
  }));

  // -- PO rollup --
  const poCounts = zeroMap(PO_STATUSES);
  let poOpenTotal = 0;
  let poCommittedTotal = 0;
  for (const po of purchaseOrders) {
    poCounts[po.status] += 1;
    const amt = num(po.total);
    if (
      po.status === 'ISSUED' ||
      po.status === 'ACKNOWLEDGED' ||
      po.status === 'PARTIALLY_RECEIVED'
    ) {
      poOpenTotal += amt;
    }
    if (po.status !== 'CANCELLED') {
      poCommittedTotal += amt;
    }
  }

  // -- Invoices --
  // We need ALL invoices for the rollup, not just the recent
  // 8. The recent 8 is for the table.
  const allInvoices = await prisma.poInvoice.findMany({
    where: { po: { projectId } },
    select: { id: true, status: true, invoiceAmount: true },
  });
  const invoiceCounts = zeroMap(INVOICE_STATUSES);
  let invoicePendingApproval = 0;
  let invoiceApprovedUnpaid = 0;
  let invoiceTotalPaid = 0;
  for (const inv of allInvoices) {
    invoiceCounts[inv.status] += 1;
    const amt = num(inv.invoiceAmount);
    if (inv.status === 'SUBMITTED') invoicePendingApproval += amt;
    else if (inv.status === 'APPROVED') invoiceApprovedUnpaid += amt;
    else if (inv.status === 'PAID') invoiceTotalPaid += amt;
  }

  const invoiceRows: InvoiceRow[] = recentInvoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    invoiceDate: i.invoiceDate,
    invoiceAmount: num(i.invoiceAmount),
    status: i.status,
    poNumber: i.po.number,
    vendorName: i.po.vendor.name,
    receivedAt: i.receivedAt,
  }));

  // -- Subs --
  const totalSubContractAmount = subAssignments.reduce(
    (acc, a) => acc + num(a.contractAmount),
    0,
  );
  const totalDivisionBudget = num(divisionBudget._sum.budget);

  const estimatedMargin = contractValue - totalSubContractAmount;
  const estimatedMarginPct =
    contractValue > 0 ? Math.round((estimatedMargin / contractValue) * 100) : 0;

  return {
    projectId,
    contractValue,
    totalBilled,
    totalPaid,
    totalReceived: totalBilled,
    outstandingAr,
    balanceToBill: Math.max(0, contractValue - totalBilled),
    percentBilled:
      contractValue > 0 ? Math.round((totalBilled / contractValue) * 100) : 0,
    estimatedMargin,
    estimatedMarginPct,
    totalSubContractAmount,
    totalDivisionBudget,
    payAppCounts,
    payAppAmountsByStatus,
    recentPayApps,
    outstandingReceivables,
    poCounts,
    poOpenTotal,
    poCommittedTotal,
    invoiceCounts,
    invoicePendingApproval,
    invoiceApprovedUnpaid,
    invoiceTotalPaid,
    recentInvoices: invoiceRows,
    subCount: subAssignments.length,
  };
}

/**
 * Lightweight rollup across ALL active projects in a workspace.
 * Used by the workspace dashboard "Financial pulse" strip.
 */
export interface WorkspaceFinancialRollup {
  totalContractValue: number;
  totalBilled: number;
  totalOutstandingAr: number;
  totalEstimatedMargin: number;
  activeProjectCount: number;
  /** Projects that have at least one overdue receivable (>30 days). */
  projectsWithOverdueAr: number;
}

export async function getWorkspaceFinancialRollup(
  workspaceId: string,
): Promise<WorkspaceFinancialRollup> {
  const activeProjects = await prisma.project.findMany({
    where: { workspaceId, status: 'ACTIVE' },
    select: {
      id: true,
      contractValue: true,
      payApps: {
        select: { status: true, totalThisDraw: true, sentAt: true },
      },
    },
  });

  let totalContractValue = 0;
  let totalBilled = 0;
  let totalOutstandingAr = 0;
  let projectsWithOverdueAr = 0;
  const now = Date.now();

  for (const p of activeProjects) {
    totalContractValue += num(p.contractValue);
    let projectOverdue = false;
    for (const pa of p.payApps) {
      const amt = num(pa.totalThisDraw);
      if (pa.status === 'PAID') {
        totalBilled += amt;
      } else if (pa.status === 'SENT' || pa.status === 'VIEWED' || pa.status === 'ACKNOWLEDGED') {
        totalBilled += amt;
        totalOutstandingAr += amt;
        if (pa.sentAt) {
          const days = (now - new Date(pa.sentAt).getTime()) / (1000 * 60 * 60 * 24);
          if (days > 30) projectOverdue = true;
        }
      }
    }
    if (projectOverdue) projectsWithOverdueAr += 1;
  }

  // The margin rollup would need sub costs per project — we
  // approximate by leaving it null here (the dedicated
  // project page does the exact calculation). The workspace
  // rollup focuses on cash: contract, billed, outstanding.
  return {
    totalContractValue,
    totalBilled,
    totalOutstandingAr,
    totalEstimatedMargin: 0,
    activeProjectCount: activeProjects.length,
    projectsWithOverdueAr,
  };
}
