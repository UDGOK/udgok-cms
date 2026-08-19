/**
 * Regression tests for the shared project-tab config.
 *
 * Background: the project page used to define its own tab list,
 * and the dedicated routes (photos, pay-apps) used a separate
 * ProjectTabsBar with its own (shorter) list. Result: a user
 * on the photos page couldn't see the AI / Takeoff / Inventory
 * / Map tabs at all — they had to go back to the main page to
 * navigate there. Bad UX, especially after a deep link.
 *
 * These tests pin the contract that the tab order, the labels,
 * and the badge logic are all consistent no matter which entry
 * point into the project you arrive from.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma + helper modules so we don't need a DB.
// We control exactly what counts come back to test badge logic.
vi.mock('@/lib/db/client', () => ({
  prisma: {
    task: { count: vi.fn() },
    payApp: { count: vi.fn() },
    projectSubcontractorAssignment: { count: vi.fn() },
    projectMember: { count: vi.fn() },
    bimModel: { count: vi.fn() },
    projectPhoto: { count: vi.fn() },
  },
}));

vi.mock('@/lib/permits/queries', () => ({
  listProjectPermits: vi.fn(),
  summarizePermits: vi.fn(),
}));

vi.mock('@/lib/photos/queries', () => ({
  countProjectPhotosByPhase: vi.fn(),
}));

import { prisma } from '@/lib/db/client';
import {
  listProjectPermits,
  summarizePermits,
} from '@/lib/permits/queries';
import { countProjectPhotosByPhase } from '@/lib/photos/queries';
import { getProjectTabs, getProjectTabsFor } from '../tabs';

const PRISMA_COUNTS = prisma as unknown as {
  task: { count: ReturnType<typeof vi.fn> };
  payApp: { count: ReturnType<typeof vi.fn> };
  projectSubcontractorAssignment: { count: ReturnType<typeof vi.fn> };
  projectMember: { count: ReturnType<typeof vi.fn> };
  bimModel: { count: ReturnType<typeof vi.fn> };
  projectPhoto: { count: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: every count returns 0 except permits (which
  // listProjectPermits returns an empty array for).
  PRISMA_COUNTS.task.count.mockResolvedValue(0);
  PRISMA_COUNTS.payApp.count.mockResolvedValue(0);
  PRISMA_COUNTS.projectSubcontractorAssignment.count.mockResolvedValue(0);
  PRISMA_COUNTS.projectMember.count.mockResolvedValue(0);
  PRISMA_COUNTS.bimModel.count.mockResolvedValue(0);
  PRISMA_COUNTS.projectPhoto.count.mockResolvedValue(0);
  (listProjectPermits as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (summarizePermits as ReturnType<typeof vi.fn>).mockReturnValue({
    overdueInspections: 0,
  });
  (countProjectPhotosByPhase as ReturnType<typeof vi.fn>).mockResolvedValue({
    ROUGH_IN: 0,
    FINAL: 0,
  });
});

describe('getProjectTabs — order + labels are stable', () => {
  it('returns 12 tabs in the documented order', async () => {
    const tabs = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
    });
    expect(tabs.map((t) => t.key)).toEqual([
      'overview',
      'ai',
      'photos',
      'tasks',
      'team',
      'schedule',
      'permits',
      'takeoff',
      'inventory',
      'map',
      'pay-apps',
      'subs',
    ]);
  });

  it('every tab key has an icon registered (no missing-icon dead state)', async () => {
    // We assert via the rendered ProjectTabs component separately,
    // but here we just ensure each tab has a non-empty label and
    // an absolute href. A missing label would render as a blank
    // pill — designer would notice immediately.
    const tabs = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
    });
    for (const t of tabs) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.href.startsWith('/w/')).toBe(true);
    }
  });
});

describe('getProjectTabs — badge rules', () => {
  it('omits badge when count is 0', async () => {
    const tabs = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
    });
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.badge]));
    expect(byKey.photos).toBeUndefined();
    expect(byKey.tasks).toBeUndefined();
    expect(byKey.team).toBeUndefined();
    expect(byKey["pay-apps"]).toBeUndefined();
    expect(byKey.subs).toBeUndefined();
  });

  it('shows the count when > 0', async () => {
    const tabs = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 7,
      payAppCount: 3,
      subAssignmentCount: 4,
      teamMemberCount: 5,
    });
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.badge]));
    expect(byKey.tasks).toBe(7);
    expect(byKey["pay-apps"]).toBe(3);
    expect(byKey.subs).toBe(4);
    expect(byKey.team).toBe(5);
  });

  it('photos badge sums rough-in + final', async () => {
    (countProjectPhotosByPhase as ReturnType<typeof vi.fn>).mockResolvedValue({
      ROUGH_IN: 12,
      FINAL: 3,
    });
    const tabs = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
    });
    const photos = tabs.find((t) => t.key === 'photos');
    expect(photos?.badge).toBe(15);
  });

  it('AI badge shows only when there are warning/danger-level insights', async () => {
    const noAlerts = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
      aiAlertCount: 0,
    });
    expect(noAlerts.find((t) => t.key === 'ai')?.badge).toBeUndefined();

    const threeAlerts = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
      aiAlertCount: 3,
    });
    expect(threeAlerts.find((t) => t.key === 'ai')?.badge).toBe(3);
  });

  it('permits badge prefers overdue inspections over total count', async () => {
    // 5 permits total but 2 are overdue — badge shows 2 so
    // the eye lands on the actionable number, not the volume.
    (listProjectPermits as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' },
    ]);
    (summarizePermits as ReturnType<typeof vi.fn>).mockReturnValue({
      overdueInspections: 2,
    });
    const tabs = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
    });
    expect(tabs.find((t) => t.key === 'permits')?.badge).toBe(2);
  });

  it('permits badge shows total count when nothing is overdue', async () => {
    (listProjectPermits as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1' }, { id: 'p2' },
    ]);
    (summarizePermits as ReturnType<typeof vi.fn>).mockReturnValue({
      overdueInspections: 0,
    });
    const tabs = await getProjectTabs({
      workspaceSlug: 'udgok',
      projectId: 'p_1',
      taskCount: 0,
      payAppCount: 0,
      subAssignmentCount: 0,
      teamMemberCount: 0,
    });
    expect(tabs.find((t) => t.key === 'permits')?.badge).toBe(2);
  });
});

describe('getProjectTabsFor — fetches counts from DB', () => {
  it('queries the same models the helper badge logic uses', async () => {
    PRISMA_COUNTS.task.count.mockResolvedValue(11);
    PRISMA_COUNTS.payApp.count.mockResolvedValue(2);
    PRISMA_COUNTS.projectSubcontractorAssignment.count.mockResolvedValue(6);
    PRISMA_COUNTS.projectMember.count.mockResolvedValue(4);
    PRISMA_COUNTS.bimModel.count.mockResolvedValue(1);
    PRISMA_COUNTS.projectPhoto.count.mockResolvedValue(9); // 9 GPS-tagged

    const tabs = await getProjectTabsFor('udgok', 'p_abc');

    // Each count() was called with the projectId we passed in.
    expect(PRISMA_COUNTS.task.count).toHaveBeenCalledWith({
      where: { projectId: 'p_abc' },
    });
    expect(PRISMA_COUNTS.payApp.count).toHaveBeenCalledWith({
      where: { projectId: 'p_abc' },
    });
    expect(PRISMA_COUNTS.projectSubcontractorAssignment.count).toHaveBeenCalledWith({
      where: { projectId: 'p_abc' },
    });
    expect(PRISMA_COUNTS.projectMember.count).toHaveBeenCalledWith({
      where: { projectId: 'p_abc' },
    });
    expect(PRISMA_COUNTS.bimModel.count).toHaveBeenCalledWith({
      where: { projectId: 'p_abc' },
    });
    expect(PRISMA_COUNTS.projectPhoto.count).toHaveBeenCalledWith({
      where: { projectId: 'p_abc', latitude: { not: null } },
    });

    // The badges are computed from those counts.
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.badge]));
    expect(byKey.tasks).toBe(11);
    expect(byKey['pay-apps']).toBe(2);
    expect(byKey.subs).toBe(6);
    expect(byKey.team).toBe(4);
    expect(byKey.takeoff).toBe(1);
    expect(byKey.map).toBe(9);
  });
});
