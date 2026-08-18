import { describe, it, expect } from 'vitest';
import { computeProjectCompletion, generateProjectInsights } from '../insights';

describe('computeProjectCompletion', () => {
  it('returns 0 for a brand new project', () => {
    const c = computeProjectCompletion({
      id: 'p1', name: 'Test', status: 'ACTIVE',
      startDate: null, endDate: null, contractValue: 100_000,
      divisions: [{ id: 'd1', budget: 100_000, payAppLines: [] }],
      payApps: [], tasks: [], subAssignments: [],
    });
    expect(c.financial).toBe(0);
    expect(c.tasks).toBe(0);
    expect(c.subs).toBe(0);
    expect(c.overall).toBe(0);
  });

  it('computes 50% financial when half billed', () => {
    const c = computeProjectCompletion({
      id: 'p1', name: 'Test', status: 'ACTIVE',
      startDate: null, endDate: null, contractValue: 100_000,
      divisions: [{ id: 'd1', budget: 100_000, payAppLines: [] }],
      payApps: [
        { id: 'pa1', status: 'SENT', totalThisDraw: 50_000, totalContract: 100_000, totalPrevious: 0, periodStart: new Date(), periodEnd: new Date(), createdAt: new Date(), divisions: [] },
      ],
      tasks: [], subAssignments: [],
    });
    expect(c.financial).toBe(50);
    expect(c.totalBilled).toBe(50_000);
    expect(c.remaining).toBe(50_000);
  });

  it('computes task % based on DONE count', () => {
    const c = computeProjectCompletion({
      id: 'p1', name: 'Test', status: 'ACTIVE',
      startDate: null, endDate: null, contractValue: null,
      divisions: [], payApps: [],
      tasks: [
        { id: 't1', status: 'DONE', priority: 'NORMAL', dueDate: null, startDate: null, endDate: null, title: 't1', assignee: null },
        { id: 't2', status: 'DONE', priority: 'NORMAL', dueDate: null, startDate: null, endDate: null, title: 't2', assignee: null },
        { id: 't3', status: 'TODO', priority: 'NORMAL', dueDate: null, startDate: null, endDate: null, title: 't3', assignee: null },
        { id: 't4', status: 'CANCELLED', priority: 'NORMAL', dueDate: null, startDate: null, endDate: null, title: 't4', assignee: null },
      ],
      subAssignments: [],
    });
    expect(c.tasks).toBe(75); // 3/4 done (DONE + CANCELLED)
    expect(c.tasksTotal).toBe(4);
    expect(c.tasksDone).toBe(3);
  });

  it('computes schedule from start/end dates', () => {
    // Use a window where "now" is right around the midpoint, regardless of test time.
    // Start 100 days ago, end 100 days from now.
    const start = new Date(Date.now() - 100 * 86_400_000);
    const end = new Date(Date.now() + 100 * 86_400_000);
    const c = computeProjectCompletion({
      id: 'p1', name: 'Test', status: 'ACTIVE',
      startDate: start, endDate: end, contractValue: 0,
      divisions: [], payApps: [],
      tasks: [], subAssignments: [],
    });
    // ~50% through a 200-day window
    expect(c.schedule).toBeGreaterThan(45);
    expect(c.schedule).toBeLessThan(55);
    expect(c.daysTotal).toBeGreaterThanOrEqual(200);
    expect(c.daysTotal).toBeLessThanOrEqual(202);
    expect(c.daysRemaining).toBeGreaterThan(0);
    // onTrack is null when there are no tasks to compare financial vs schedule
    expect(c.onTrack).toBeNull();
  });
});

describe('generateProjectInsights', () => {
  it('warns about no pay apps on an active project', () => {
    const insights = generateProjectInsights(
      {
        id: 'p1', name: 'Active job', status: 'ACTIVE',
        startDate: new Date(), endDate: new Date(),
        contractValue: 100_000,
        divisions: [], payApps: [], tasks: [],
        subAssignments: [],
      },
      computeProjectCompletion({
        id: 'p1', name: 'Active job', status: 'ACTIVE',
        startDate: new Date(), endDate: new Date(), contractValue: 100_000,
        divisions: [], payApps: [], tasks: [], subAssignments: [],
      }),
    );
    expect(insights.find((i) => i.id === 'no-pay-apps')).toBeDefined();
  });

  it('flags overdue tasks', () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const insights = generateProjectInsights(
      {
        id: 'p1', name: 'Test', status: 'ACTIVE',
        startDate: null, endDate: null, contractValue: null,
        divisions: [], payApps: [],
        tasks: [
          { id: 't1', status: 'TODO', priority: 'HIGH', dueDate: yesterday, startDate: null, endDate: null, title: 'overdue', assignee: null },
        ],
        subAssignments: [],
      },
      computeProjectCompletion({
        id: 'p1', name: 'Test', status: 'ACTIVE',
        startDate: null, endDate: null, contractValue: null,
        divisions: [], payApps: [],
        tasks: [
          { id: 't1', status: 'TODO', priority: 'HIGH', dueDate: yesterday, startDate: null, endDate: null, title: 'overdue', assignee: null },
        ],
        subAssignments: [],
      }),
    );
    const overdue = insights.find((i) => i.id === 'overdue-tasks');
    expect(overdue).toBeDefined();
    expect(overdue?.level).toBe('danger');
  });

  it('returns an "all good" message when there are no issues', () => {
    const insights = generateProjectInsights(
      {
        id: 'p1', name: 'Test', status: 'COMPLETED',
        startDate: null, endDate: null, contractValue: null,
        divisions: [], payApps: [],
        tasks: [],
        subAssignments: [],
      },
      computeProjectCompletion({
        id: 'p1', name: 'Test', status: 'COMPLETED',
        startDate: null, endDate: null, contractValue: null,
        divisions: [], payApps: [],
        tasks: [],
        subAssignments: [],
      }),
    );
    expect(insights.find((i) => i.id === 'all-good')).toBeDefined();
  });
});
