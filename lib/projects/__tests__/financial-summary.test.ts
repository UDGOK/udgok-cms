/**
 * Tests for the project financial summary query.
 *
 * The summary is a single batched read that powers:
 *   - The embedded FinancialSummary card on the project page
 *   - The dedicated /financials deep-dive page
 *   - The workspace-dashboard "Financial pulse" rollup
 *
 * These tests exercise the math (totals, buckets, aging)
 * with a fully-mocked Prisma layer. The SQL itself is
 * trivial — what's worth testing is the rollup logic
 * (status buckets, AR aging, margin calculation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Prisma mocks ---
const projectFindUniqueOrThrow = vi.fn();
const payAppFindMany = vi.fn();
const purchaseOrderFindMany = vi.fn();
const projectSubcontractorAssignmentFindMany = vi.fn();
const projectDivisionAggregate = vi.fn();
const poInvoiceFindMany = vi.fn();
const projectFindMany = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: {
      findUniqueOrThrow: (...a: unknown[]) => projectFindUniqueOrThrow(...a),
      findMany: (...a: unknown[]) => projectFindMany(...a),
    },
    payApp: { findMany: (...a: unknown[]) => payAppFindMany(...a) },
    purchaseOrder: { findMany: (...a: unknown[]) => purchaseOrderFindMany(...a) },
    projectSubcontractorAssignment: {
      findMany: (...a: unknown[]) => projectSubcontractorAssignmentFindMany(...a),
    },
    projectDivision: { aggregate: (...a: unknown[]) => projectDivisionAggregate(...a) },
    poInvoice: { findMany: (...a: unknown[]) => poInvoiceFindMany(...a) },
  },
}));

import {
  getProjectFinancialSummary,
  getWorkspaceFinancialRollup,
} from '../financial-summary';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProjectFinancialSummary', () => {
  it('returns zero values for a project with no pay apps, POs, or subs', async () => {
    projectFindUniqueOrThrow.mockResolvedValue({ id: 'p_1', contractValue: 0 });
    payAppFindMany.mockResolvedValue([]);
    purchaseOrderFindMany.mockResolvedValue([]);
    projectSubcontractorAssignmentFindMany.mockResolvedValue([]);
    projectDivisionAggregate.mockResolvedValue({ _sum: { budget: 0 } });
    poInvoiceFindMany.mockResolvedValue([]);

    const s = await getProjectFinancialSummary('p_1');

    expect(s.projectId).toBe('p_1');
    expect(s.contractValue).toBe(0);
    expect(s.totalBilled).toBe(0);
    expect(s.outstandingAr).toBe(0);
    expect(s.balanceToBill).toBe(0);
    expect(s.percentBilled).toBe(0);
    expect(s.estimatedMargin).toBe(0);
    expect(s.estimatedMarginPct).toBe(0);
    expect(s.subCount).toBe(0);
    expect(Object.values(s.payAppCounts).every((c) => c === 0)).toBe(true);
    expect(Object.values(s.poCounts).every((c) => c === 0)).toBe(true);
  });

  it('rolls up pay apps by status and computes outstanding AR correctly', async () => {
    projectFindUniqueOrThrow.mockResolvedValue({ id: 'p_1', contractValue: 100000 });
    payAppFindMany.mockResolvedValue([
      {
        id: 'pa_1', drawNumber: 1, status: 'PAID',
        totalThisDraw: { toString: () => '20000' },
        totalContract: { toString: () => '100000' },
        totalPrevious: { toString: () => '0' },
        totalBalance: { toString: () => '80000' },
        periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
        sentAt: new Date('2026-01-15'), acknowledgedAt: new Date('2026-01-20'),
        firstViewedAt: new Date('2026-01-18'),
        pdfUrl: null,
        divisions: [],
      },
      {
        id: 'pa_2', drawNumber: 2, status: 'SENT',
        totalThisDraw: { toString: () => '15000' },
        totalContract: { toString: () => '100000' },
        totalPrevious: { toString: () => '20000' },
        totalBalance: { toString: () => '65000' },
        periodStart: new Date('2026-02-01'), periodEnd: new Date('2026-02-28'),
        sentAt: new Date('2026-02-15'), acknowledgedAt: null, firstViewedAt: null,
        pdfUrl: null,
        divisions: [],
      },
      {
        id: 'pa_3', drawNumber: 3, status: 'DRAFT',
        totalThisDraw: { toString: () => '10000' },
        totalContract: { toString: () => '100000' },
        totalPrevious: { toString: () => '35000' },
        totalBalance: { toString: () => '55000' },
        periodStart: new Date('2026-03-01'), periodEnd: new Date('2026-03-31'),
        sentAt: null, acknowledgedAt: null, firstViewedAt: null,
        pdfUrl: null,
        divisions: [],
      },
    ]);
    purchaseOrderFindMany.mockResolvedValue([]);
    projectSubcontractorAssignmentFindMany.mockResolvedValue([]);
    projectDivisionAggregate.mockResolvedValue({ _sum: { budget: 0 } });
    poInvoiceFindMany.mockResolvedValue([]);

    const s = await getProjectFinancialSummary('p_1');

    expect(s.totalPaid).toBe(20000);
    expect(s.totalBilled).toBe(35000); // 20k paid + 15k sent
    expect(s.outstandingAr).toBe(15000); // only the SENT one
    expect(s.balanceToBill).toBe(65000);
    expect(s.percentBilled).toBe(35);
    expect(s.payAppCounts.PAID).toBe(1);
    expect(s.payAppCounts.SENT).toBe(1);
    expect(s.payAppCounts.DRAFT).toBe(1);
    // DRAFT is not in outstanding
    expect(s.outstandingReceivables.length).toBe(1);
    expect(s.outstandingReceivables[0].id).toBe('pa_2');
  });

  it('computes estimated margin as contractValue minus subContractTotal', async () => {
    projectFindUniqueOrThrow.mockResolvedValue({ id: 'p_1', contractValue: 200000 });
    payAppFindMany.mockResolvedValue([]);
    purchaseOrderFindMany.mockResolvedValue([]);
    projectSubcontractorAssignmentFindMany.mockResolvedValue([
      { contractAmount: { toString: () => '60000' } },
      { contractAmount: { toString: () => '50000' } },
    ]);
    projectDivisionAggregate.mockResolvedValue({ _sum: { budget: 0 } });
    poInvoiceFindMany.mockResolvedValue([]);

    const s = await getProjectFinancialSummary('p_1');
    expect(s.totalSubContractAmount).toBe(110000);
    expect(s.estimatedMargin).toBe(90000);
    expect(s.estimatedMarginPct).toBe(45);
  });

  it('rolls up POs by status and computes open total (ISSUED/ACK/PARTIAL)', async () => {
    projectFindUniqueOrThrow.mockResolvedValue({ id: 'p_1', contractValue: 0 });
    payAppFindMany.mockResolvedValue([]);
    purchaseOrderFindMany.mockResolvedValue([
      { id: 'po_1', status: 'ISSUED', total: { toString: () => '5000' }, number: 'PO-1' },
      { id: 'po_2', status: 'ACKNOWLEDGED', total: { toString: () => '3000' }, number: 'PO-2' },
      { id: 'po_3', status: 'PARTIALLY_RECEIVED', total: { toString: () => '2000' }, number: 'PO-3' },
      { id: 'po_4', status: 'CANCELLED', total: { toString: () => '1000' }, number: 'PO-4' },
    ]);
    projectSubcontractorAssignmentFindMany.mockResolvedValue([]);
    projectDivisionAggregate.mockResolvedValue({ _sum: { budget: 0 } });
    poInvoiceFindMany.mockResolvedValue([]);

    const s = await getProjectFinancialSummary('p_1');
    expect(s.poOpenTotal).toBe(10000); // ISSUED + ACK + PARTIAL, not CANCELLED
    expect(s.poCommittedTotal).toBe(10000); // all non-cancelled
    expect(s.poCounts.ISSUED).toBe(1);
    expect(s.poCounts.CANCELLED).toBe(1);
  });

  it('rolls up PO invoices by status (submitted/approved/paid)', async () => {
    projectFindUniqueOrThrow.mockResolvedValue({ id: 'p_1', contractValue: 0 });
    payAppFindMany.mockResolvedValue([]);
    purchaseOrderFindMany.mockResolvedValue([]);
    projectSubcontractorAssignmentFindMany.mockResolvedValue([]);
    projectDivisionAggregate.mockResolvedValue({ _sum: { budget: 0 } });
    // First call is the recentInvoices fetch (limited), second is the full rollup
    poInvoiceFindMany
      .mockResolvedValueOnce([]) // recent
      .mockResolvedValueOnce([
        { id: 'i_1', status: 'SUBMITTED', invoiceAmount: { toString: () => '1000' } },
        { id: 'i_2', status: 'SUBMITTED', invoiceAmount: { toString: () => '500' } },
        { id: 'i_3', status: 'APPROVED', invoiceAmount: { toString: () => '2000' } },
        { id: 'i_4', status: 'PAID', invoiceAmount: { toString: () => '3000' } },
        { id: 'i_5', status: 'DISPUTED', invoiceAmount: { toString: () => '400' } },
      ]);

    const s = await getProjectFinancialSummary('p_1');
    expect(s.invoicePendingApproval).toBe(1500);
    expect(s.invoiceApprovedUnpaid).toBe(2000);
    expect(s.invoiceTotalPaid).toBe(3000);
    expect(s.invoiceCounts.SUBMITTED).toBe(2);
    expect(s.invoiceCounts.APPROVED).toBe(1);
    expect(s.invoiceCounts.PAID).toBe(1);
    expect(s.invoiceCounts.DISPUTED).toBe(1);
  });

  it('days-since-sent uses the earliest of sentAt / firstViewedAt / periodEnd', async () => {
    projectFindUniqueOrThrow.mockResolvedValue({ id: 'p_1', contractValue: 100000 });
    // Two sent pay apps: one 5 days old, one 60 days old
    const now = Date.now();
    const fiveDaysAgo = new Date(now - 5 * 86400_000);
    const sixtyDaysAgo = new Date(now - 60 * 86400_000);
    payAppFindMany.mockResolvedValue([
      {
        id: 'pa_recent', drawNumber: 1, status: 'SENT',
        totalThisDraw: { toString: () => '5000' },
        totalContract: { toString: () => '5000' },
        totalPrevious: { toString: () => '0' },
        totalBalance: { toString: () => '0' },
        periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
        sentAt: fiveDaysAgo, acknowledgedAt: null, firstViewedAt: null,
        pdfUrl: null, divisions: [],
      },
      {
        id: 'pa_old', drawNumber: 2, status: 'ACKNOWLEDGED',
        totalThisDraw: { toString: () => '5000' },
        totalContract: { toString: () => '10000' },
        totalPrevious: { toString: () => '5000' },
        totalBalance: { toString: () => '0' },
        periodStart: new Date('2025-12-01'), periodEnd: new Date('2025-12-31'),
        sentAt: sixtyDaysAgo, acknowledgedAt: new Date(), firstViewedAt: null,
        pdfUrl: null, divisions: [],
      },
    ]);
    purchaseOrderFindMany.mockResolvedValue([]);
    projectSubcontractorAssignmentFindMany.mockResolvedValue([]);
    projectDivisionAggregate.mockResolvedValue({ _sum: { budget: 0 } });
    poInvoiceFindMany.mockResolvedValue([]);

    const s = await getProjectFinancialSummary('p_1');
    expect(s.outstandingReceivables.length).toBe(2);
    // Oldest first (sorted by daysSinceSent desc)
    expect(s.outstandingReceivables[0].id).toBe('pa_old');
    expect(s.outstandingReceivables[0].daysSinceSent).toBeGreaterThanOrEqual(59);
    expect(s.outstandingReceivables[0].daysSinceSent).toBeLessThanOrEqual(61);
    expect(s.outstandingReceivables[1].id).toBe('pa_recent');
    expect(s.outstandingReceivables[1].daysSinceSent).toBeGreaterThanOrEqual(4);
    expect(s.outstandingReceivables[1].daysSinceSent).toBeLessThanOrEqual(6);
  });
});

describe('getWorkspaceFinancialRollup', () => {
  it('aggregates contract + billed + outstanding across all active projects', async () => {
    projectFindMany.mockResolvedValue([
      {
        id: 'p_1',
        contractValue: { toString: () => '100000' },
        payApps: [
          { status: 'PAID', totalThisDraw: { toString: () => '50000' }, sentAt: new Date() },
          { status: 'SENT', totalThisDraw: { toString: () => '10000' }, sentAt: new Date(Date.now() - 5 * 86400_000) },
        ],
      },
      {
        id: 'p_2',
        contractValue: { toString: () => '50000' },
        payApps: [
          { status: 'SENT', totalThisDraw: { toString: () => '5000' }, sentAt: new Date(Date.now() - 45 * 86400_000) },
        ],
      },
      {
        // No contractValue, no pay apps
        id: 'p_3', contractValue: null, payApps: [],
      },
    ]);

    const r = await getWorkspaceFinancialRollup('w_1');
    expect(r.totalContractValue).toBe(150000);
    expect(r.totalBilled).toBe(65000); // 50k paid + 10k + 5k sent
    expect(r.totalOutstandingAr).toBe(15000); // 10k + 5k
    expect(r.activeProjectCount).toBe(3);
    // p_2 has a 45-day-old receivable, so 1 project is "overdue"
    expect(r.projectsWithOverdueAr).toBe(1);
  });

  it('returns zeros for a workspace with no active projects', async () => {
    projectFindMany.mockResolvedValue([]);
    const r = await getWorkspaceFinancialRollup('w_1');
    expect(r.totalContractValue).toBe(0);
    expect(r.totalBilled).toBe(0);
    expect(r.activeProjectCount).toBe(0);
    expect(r.projectsWithOverdueAr).toBe(0);
  });
});
