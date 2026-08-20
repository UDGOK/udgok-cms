/**
 * Timesheet read queries. Server-only — uses
 * Prisma directly.
 *
 * The hot queries here are:
 *   - weekly grid for the workspace (employees + subs)
 *   - per-person detail (events list for the week)
 *   - "open check-ins" alert list (for the banner)
 *
 * Hours math lives in ./hours.ts so the same rules
 * apply to the PDF generator.
 */

import { prisma } from '@/lib/db/client';
import {
  effectiveHours,
  isSameLocalDay,
  startOfWeek,
  sumHours,
  weekDays,
} from './hours';

export type EventRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string | null;
  siteLabel: string | null;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  note: string | null;
  hours: number | null;
  isOpen: boolean;
  isEdited: boolean;
  editedByName: string | null;
  editedAt: Date | null;
  editNote: string | null;
};

export type PersonRow = {
  // For employees: userId. For subs: subId prefixed
  // with "sub:" so the grid can dedupe across types.
  id: string;
  kind: 'employee' | 'sub';
  name: string;
  secondaryLabel: string | null; // e.g. role or trade
  // Hours per day of the week, indexed 0 (Mon) .. 6 (Sun)
  dailyHours: (number | null)[];
  totalHours: number;
  openCount: number; // count of still-open events this week
};

export type WeeklyGrid = {
  weekStart: Date;
  weekEnd: Date;
  days: Date[];
  employees: PersonRow[];
  subs: PersonRow[];
  employeeTotalHours: number;
  subTotalHours: number;
  openEventsCount: number; // across both groups
};

/**
 * Workspace weekly grid for a given week (or
 * current week if `anchor` is omitted). Returns
 * employees and subs grouped, with a daily-hours
 * grid per person.
 */
export async function getWeeklyGrid(
  workspaceId: string,
  anchor: Date = new Date(),
): Promise<WeeklyGrid> {
  const days = weekDays(anchor);
  const weekStart = days[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Fetch all events in this week, eager-loaded with
  // the user / sub / project we need to display.
  const events = await prisma.checkInEvent.findMany({
    where: {
      workspaceId,
      checkedInAt: { gte: weekStart, lt: weekEnd },
    },
    include: {
      project: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, name: true, email: true, memberships: { where: { workspaceId }, select: { role: true } } } },
      subcontractor: { select: { id: true, name: true, primaryTrade: true } },
      siteCheckInCode: { select: { label: true } },
      editedBy: { select: { name: true, email: true } },
    },
    orderBy: { checkedInAt: 'asc' },
  });

  // Bucket events by (kind, id).
  type Bucket = { events: typeof events; row: Omit<PersonRow, 'dailyHours' | 'totalHours' | 'openCount'> };
  const buckets = new Map<string, Bucket>();
  for (const e of events) {
    let key: string;
    let row: Omit<PersonRow, 'dailyHours' | 'totalHours' | 'openCount'>;
    if (e.userId && e.user) {
      key = `emp:${e.userId}`;
      row = {
        id: e.userId,
        kind: 'employee',
        name: e.user.name ?? e.user.email,
        secondaryLabel: e.user.memberships[0]?.role ?? null,
      };
    } else if (e.subcontractorId && e.subcontractor) {
      key = `sub:${e.subcontractorId}`;
      row = {
        id: e.subcontractorId,
        kind: 'sub',
        name: e.subcontractor.name,
        secondaryLabel: e.subcontractor.primaryTrade,
      };
    } else {
      // Orphan event (sub got deleted, or user got
      // deleted from workspace). Skip from the grid
      // but the raw event still shows in detail
      // queries.
      continue;
    }
    let b = buckets.get(key);
    if (!b) {
      b = { events: [], row };
      buckets.set(key, b);
    }
    b.events.push(e);
  }

  // Project each bucket into a PersonRow.
  const rows: PersonRow[] = [];
  const bucketValues = Array.from(buckets.values());
  for (const { events: evs, row } of bucketValues) {
    const dailyHours: (number | null)[] = Array.from({ length: 7 }, () => null);
    let totalHours = 0;
    let openCount = 0;
    for (const e of evs) {
      const h = effectiveHours(e);
      if (h === null) {
        openCount += 1;
      } else {
        // Add to the day bucket.
        const dayIdx = days.findIndex((d) => isSameLocalDay(d, e.checkedInAt));
        if (dayIdx >= 0) {
          dailyHours[dayIdx] = (dailyHours[dayIdx] ?? 0) + h;
        }
        totalHours += h;
      }
    }
    // Round the daily + total to 2 decimals.
    for (let i = 0; i < 7; i++) {
      if (dailyHours[i] !== null) {
        dailyHours[i] = Math.round((dailyHours[i] as number) * 100) / 100;
      }
    }
    rows.push({
      ...row,
      dailyHours,
      totalHours: Math.round(totalHours * 100) / 100,
      openCount,
    });
  }

  // Sort: employees first, then subs; alpha within
  // each group.
  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'employee' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const employees = rows.filter((r) => r.kind === 'employee');
  const subs = rows.filter((r) => r.kind === 'sub');

  const employeeTotalHours = Math.round(sumHours(employees.flatMap(() => [])) * 100) / 100;
  // sumHours is from ./hours — re-import to keep the
  // helper self-contained.
  const subTotalHours = Math.round(sumHours(subs.flatMap(() => [])) * 100) / 100;

  // The "open events count" for the banner.
  const openEventsCount = await prisma.checkInEvent.count({
    where: {
      workspaceId,
      checkedOutAt: null,
      checkedInAt: { lt: weekEnd },
    },
  });

  return {
    weekStart,
    weekEnd,
    days,
    employees,
    subs,
    employeeTotalHours,
    subTotalHours,
    openEventsCount,
  };
}

/**
 * Per-employee detail for a week. Returns the
 * person's name + role + a list of EventRow for the
 * week.
 */
export async function getEmployeeTimesheet(
  workspaceId: string,
  userId: string,
  anchor: Date = new Date(),
): Promise<{
  user: { id: string; name: string; email: string; role: string | null };
  weekStart: Date;
  weekEnd: Date;
  days: Date[];
  events: EventRow[];
  totalHours: number;
  openCount: number;
  totalEvents: number;
}> {
  const days = weekDays(anchor);
  const weekStart = days[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [user, rawEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { where: { workspaceId }, select: { role: true } },
      },
    }),
    prisma.checkInEvent.findMany({
      where: {
        workspaceId,
        userId,
        checkedInAt: { gte: weekStart, lt: weekEnd },
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        siteCheckInCode: { select: { label: true } },
        editedBy: { select: { name: true, email: true } },
      },
      orderBy: { checkedInAt: 'asc' },
    }),
  ]);

  if (!user) {
    return {
      user: { id: userId, name: 'Unknown', email: '', role: null },
      weekStart,
      weekEnd,
      days,
      events: [],
      totalHours: 0,
      openCount: 0,
      totalEvents: 0,
    };
  }

  const events: EventRow[] = rawEvents.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    projectName: e.project.name,
    projectCode: e.project.code,
    siteLabel: e.siteCheckInCode.label,
    checkedInAt: e.checkedInAt,
    checkedOutAt: e.checkedOutAt,
    note: e.note,
    hours: effectiveHours(e),
    isOpen: e.checkedOutAt === null && e.editedHours === null,
    isEdited: e.editedHours !== null,
    editedByName: e.editedBy?.name ?? e.editedBy?.email ?? null,
    editedAt: e.editedAt,
    editNote: e.editNote,
  }));

  return {
    user: {
      id: user.id,
      name: user.name ?? user.email,
      email: user.email,
      role: user.memberships[0]?.role ?? null,
    },
    weekStart,
    weekEnd,
    days,
    events,
    totalHours: Math.round(sumHours(rawEvents) * 100) / 100,
    openCount: events.filter((e) => e.isOpen).length,
    totalEvents: events.length,
  };
}

/**
 * Per-sub detail for a week. Same shape as the
 * employee version, keyed off subcontractorId.
 */
export async function getSubTimesheet(
  workspaceId: string,
  subId: string,
  anchor: Date = new Date(),
): Promise<{
  sub: { id: string; name: string; primaryTrade: string | null };
  weekStart: Date;
  weekEnd: Date;
  days: Date[];
  events: EventRow[];
  totalHours: number;
  openCount: number;
  totalEvents: number;
}> {
  const days = weekDays(anchor);
  const weekStart = days[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [sub, rawEvents] = await Promise.all([
    prisma.subcontractor.findUnique({ where: { id: subId } }),
    prisma.checkInEvent.findMany({
      where: {
        workspaceId,
        subcontractorId: subId,
        checkedInAt: { gte: weekStart, lt: weekEnd },
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        siteCheckInCode: { select: { label: true } },
        editedBy: { select: { name: true, email: true } },
      },
      orderBy: { checkedInAt: 'asc' },
    }),
  ]);

  if (!sub) {
    return {
      sub: { id: subId, name: 'Unknown', primaryTrade: null },
      weekStart,
      weekEnd,
      days,
      events: [],
      totalHours: 0,
      openCount: 0,
      totalEvents: 0,
    };
  }

  const events: EventRow[] = rawEvents.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    projectName: e.project.name,
    projectCode: e.project.code,
    siteLabel: e.siteCheckInCode.label,
    checkedInAt: e.checkedInAt,
    checkedOutAt: e.checkedOutAt,
    note: e.note,
    hours: effectiveHours(e),
    isOpen: e.checkedOutAt === null && e.editedHours === null,
    isEdited: e.editedHours !== null,
    editedByName: e.editedBy?.name ?? e.editedBy?.email ?? null,
    editedAt: e.editedAt,
    editNote: e.editNote,
  }));

  return {
    sub: { id: sub.id, name: sub.name, primaryTrade: sub.primaryTrade },
    weekStart,
    weekEnd,
    days,
    events,
    totalHours: Math.round(sumHours(rawEvents) * 100) / 100,
    openCount: events.filter((e) => e.isOpen).length,
    totalEvents: events.length,
  };
}

/**
 * The "needs action" open-check-in banner. Returns
 * events that are still open, with the "open for X
 * hours" computed for the warning copy.
 */
export async function getOpenCheckIns(
  workspaceId: string,
): Promise<
  Array<{
    id: string;
    projectId: string;
    projectName: string;
    whoName: string;
    whoKind: 'employee' | 'sub' | 'unknown';
    checkedInAt: Date;
    hoursOpen: number;
    siteLabel: string | null;
  }>
> {
  const events = await prisma.checkInEvent.findMany({
    where: {
      workspaceId,
      checkedOutAt: null,
    },
    include: {
      project: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
      subcontractor: { select: { id: true, name: true } },
      siteCheckInCode: { select: { label: true } },
    },
    orderBy: { checkedInAt: 'asc' },
  });

  const now = Date.now();
  return events.map((e) => {
    const hoursOpen = Math.round(((now - e.checkedInAt.getTime()) / 3_600_000) * 10) / 10;
    let whoName = 'Unknown';
    let whoKind: 'employee' | 'sub' | 'unknown' = 'unknown';
    if (e.user) {
      whoName = e.user.name ?? e.user.email;
      whoKind = 'employee';
    } else if (e.subcontractor) {
      whoName = e.subcontractor.name;
      whoKind = 'sub';
    }
    return {
      id: e.id,
      projectId: e.projectId,
      projectName: e.project.name,
      whoName,
      whoKind,
      checkedInAt: e.checkedInAt,
      hoursOpen,
      siteLabel: e.siteCheckInCode.label,
    };
  });
}

// =====================================================================
// Resolvers — the helpers the pages call to look up a single
// row by ID. Kept here so the actions layer can re-use them
// when enforcing the "this event belongs to this workspace"
// check.
// =====================================================================

export async function getEventForEdit(eventId: string, workspaceId: string) {
  return prisma.checkInEvent.findFirst({
    where: { id: eventId, workspaceId },
    include: {
      project: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
      subcontractor: { select: { id: true, name: true } },
      editedBy: { select: { name: true, email: true } },
    },
  });
}

// Mark startOfWeek as re-exported for callers that
// want the canonical "this week" anchor.
export { startOfWeek };
