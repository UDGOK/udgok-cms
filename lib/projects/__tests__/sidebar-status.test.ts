/**
 * Tests for the project sidebar status query.
 *
 * The query powers every status badge in the new vertical sidebar:
 *   - tasks open + overdue
 *   - photos + GPS photos
 *   - pay apps in flight + overdue
 *   - outstanding AR dollars
 *   - sub active counts
 *   - check-ins currently on site
 *   - permit overdue inspections
 *   - AI alert count (overdue tasks + disputed invoices)
 *
 * All counts roll into a badges object keyed by sidebar item key,
 * with tone (default / warn / danger / hot) so the sidebar can
 * render with the right color without re-deriving anything.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Prisma mocks ---
const projectFindFirst = vi.fn();
const projectFindFirstOrThrow = vi.fn();
const projectPhotoCount = vi.fn();
const taskGroupBy = vi.fn();
const taskCount = vi.fn();
const projectMemberCount = vi.fn();
const bimModelCount = vi.fn();
const projectSubcontractorAssignmentCount = vi.fn();
const checkInEventCount = vi.fn();
const permitFindMany = vi.fn();
const payAppFindMany = vi.fn();
const poInvoiceCount = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: {
      findFirst: (...a: unknown[]) => projectFindFirst(...a),
      findFirstOrThrow: (...a: unknown[]) => projectFindFirstOrThrow(...a),
    },
    projectPhoto: { count: (...a: unknown[]) => projectPhotoCount(...a) },
    task: {
      groupBy: (...a: unknown[]) => taskGroupBy(...a),
      count: (...a: unknown[]) => taskCount(...a),
    },
    projectMember: { count: (...a: unknown[]) => projectMemberCount(...a) },
    bimModel: { count: (...a: unknown[]) => bimModelCount(...a) },
    projectSubcontractorAssignment: { count: (...a: unknown[]) => projectSubcontractorAssignmentCount(...a) },
    checkInEvent: { count: (...a: unknown[]) => checkInEventCount(...a) },
    permit: { findMany: (...a: unknown[]) => permitFindMany(...a) },
    payApp: { findMany: (...a: unknown[]) => payAppFindMany(...a) },
    poInvoice: { count: (...a: unknown[]) => poInvoiceCount(...a) },
  },
}));

vi.mock('@/lib/projects/financial-summary', () => ({
  getProjectFinancialSummary: vi.fn().mockResolvedValue({
    projectId: 'p_1',
    contractValue: 100000,
    totalBilled: 50000,
    outstandingAr: 10000,
    estimatedMarginPct: 22,
    poOpenTotal: 0,
    invoicePendingApproval: 0,
    invoiceApprovedUnpaid: 0,
    payAppCounts: { DRAFT: 0, SENT: 1, VIEWED: 0, ACKNOWLEDGED: 0, PAID: 1 },
    payAppAmountsByStatus: { DRAFT: 0, SENT: 10000, VIEWED: 0, ACKNOWLEDGED: 0, PAID: 50000 },
  }),
}));

import { getProjectSidebarStatus } from '../sidebar-status';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: empty project
  projectFindFirstOrThrow.mockResolvedValue({ id: 'p_1', startDate: null, endDate: null });
  projectPhotoCount.mockResolvedValue(0);
  taskGroupBy.mockResolvedValue([]);
  taskCount.mockResolvedValue(0);
  projectMemberCount.mockResolvedValue(0);
  bimModelCount.mockResolvedValue(0);
  projectSubcontractorAssignmentCount.mockResolvedValue(0);
  checkInEventCount.mockResolvedValue(0);
  permitFindMany.mockResolvedValue([]);
  payAppFindMany.mockResolvedValue([]);
  poInvoiceCount.mockResolvedValue(0);
});

describe('getProjectSidebarStatus', () => {
  it('returns zero-state when project is empty', async () => {
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.taskOpen).toBe(0);
    expect(s.taskOverdue).toBe(0);
    expect(s.openCheckInCount).toBe(0);
    expect(s.aiAlertCount).toBe(0);
    expect(s.payAppOpenCount).toBe(0);
    expect(s.payAppOverdueCount).toBe(0);
    expect(s.subActiveCount).toBe(0);
    expect(s.estimatedMarginPct).toBe(22);
  });

  it('marks tasks badge as danger when there are overdue tasks', async () => {
    taskGroupBy.mockResolvedValue([
      { status: 'TODO', _count: 5 },
      { status: 'IN_PROGRESS', _count: 2 },
    ]);
    taskCount.mockResolvedValue(2); // 2 overdue
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.taskOpen).toBe(7);
    expect(s.taskOverdue).toBe(2);
    expect(s.badges.tasks).toEqual(expect.objectContaining({
      kind: 'count',
      value: 7,
      tone: 'danger',
    }));
  });

  it('marks tasks badge as warn when open but none overdue', async () => {
    taskGroupBy.mockResolvedValue([{ status: 'TODO', _count: 3 }]);
    taskCount.mockResolvedValue(0);
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.tasks).toEqual(expect.objectContaining({
      kind: 'count',
      value: 3,
      tone: 'warn',
    }));
  });

  it('omits tasks badge when nothing is open', async () => {
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.tasks).toBeUndefined();
  });

  it('marks pay-apps badge as money danger when 30+ days overdue', async () => {
    const longAgo = new Date(Date.now() - 45 * 86400_000);
    payAppFindMany.mockResolvedValue([
      { status: 'SENT', sentAt: longAgo },
      { status: 'PAID', sentAt: longAgo },
    ]);
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.payAppOpenCount).toBe(1);
    expect(s.payAppOverdueCount).toBe(1);
    expect(s.badges['pay-apps']).toEqual(expect.objectContaining({
      kind: 'money',
      tone: 'danger',
    }));
  });

  it('marks pay-apps badge as money warn when outstanding but <30 days', async () => {
    const recent = new Date(Date.now() - 5 * 86400_000);
    payAppFindMany.mockResolvedValue([{ status: 'SENT', sentAt: recent }]);
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.payAppOverdueCount).toBe(0);
    expect(s.badges['pay-apps']).toEqual(expect.objectContaining({
      kind: 'money',
      tone: 'warn',
    }));
  });

  it('marks check-ins badge as hot (orange) when on site', async () => {
    checkInEventCount.mockResolvedValue(5);
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.checkins).toEqual(expect.objectContaining({
      kind: 'hot',
      value: 5,
      tone: 'hot',
    }));
  });

  it('omits check-ins badge when nobody is on site', async () => {
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.checkins).toBeUndefined();
  });

  it('marks permits badge as danger when there are overdue inspections', async () => {
    permitFindMany.mockResolvedValue([
      {
        id: 'permit_1',
        inspections: [
          { id: 'i_1', result: 'FAILED', scheduledDate: new Date() },
        ],
      },
    ]);
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.permitOverdueInspections).toBe(1);
    expect(s.badges.permits).toEqual(expect.objectContaining({
      tone: 'danger',
    }));
  });

  it('marks permits badge as default when permits exist but no overdue', async () => {
    permitFindMany.mockResolvedValue([
      {
        id: 'permit_1',
        inspections: [
          { id: 'i_1', result: 'PASSED', scheduledDate: new Date() },
        ],
      },
    ]);
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.permitOverdueInspections).toBe(0);
    expect(s.badges.permits).toEqual(expect.objectContaining({
      kind: 'count',
      value: 1,
      tone: 'default',
    }));
  });

  it('marks AI badge as warn when there are alerts', async () => {
    taskCount.mockResolvedValue(2); // overdue
    poInvoiceCount.mockResolvedValue(1); // disputed
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.aiAlertCount).toBe(3);
    expect(s.badges.ai).toEqual(expect.objectContaining({
      kind: 'count',
      value: 3,
      tone: 'warn',
    }));
  });

  it('omits AI badge when there are no alerts', async () => {
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.ai).toBeUndefined();
  });

  it('marks financials badge as danger when margin is below 15%', async () => {
    // Mock the financial summary to return a low margin
    const { getProjectFinancialSummary } = await import('@/lib/projects/financial-summary');
    (getProjectFinancialSummary as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      contractValue: 100000,
      estimatedMarginPct: 10,
      outstandingAr: 0,
      payAppCounts: {},
    });
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.financials).toEqual(expect.objectContaining({
      tone: 'danger',
    }));
  });

  it('omits photos badge when no photos', async () => {
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.photos).toBeUndefined();
  });

  it('shows photo count badge when photos exist', async () => {
    projectPhotoCount.mockResolvedValue(42);
    const s = await getProjectSidebarStatus('w_1', 'p_1');
    expect(s.badges.photos).toEqual(expect.objectContaining({
      value: 42,
      tone: 'default',
    }));
  });
});
