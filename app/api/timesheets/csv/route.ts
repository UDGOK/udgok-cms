/**
 * GET /api/timesheets/csv
 *
 * Workspace weekly summary CSV. One row per
 * (person, week); columns = person + status + Mon..Sun
 * + total + event count + open count.
 *
 * Useful for the accountant / GC's high-level view.
 * The detail per-person route is for the auditor's
 * per-event view.
 *
 * Auth: any workspace member.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getWeeklyGrid } from '@/lib/timesheets/queries';
import { weekDays, isSameLocalDay, dayLabel, formatHours } from '@/lib/timesheets/hours';
import { toCsv, csvHeaders } from '@/lib/timesheets/csv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { userId: sessionUserId } = await auth();
  if (!sessionUserId) {
    return new NextResponse('Not signed in', { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) return new NextResponse('Missing slug', { status: 400 });

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!workspace) return new NextResponse('Workspace not found', { status: 404 });
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: sessionUserId, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  let anchor = new Date();
  if (searchParams.get('week')) {
    const d = new Date(searchParams.get('week')!);
    if (!Number.isNaN(d.getTime())) anchor = d;
  }

  const grid = await getWeeklyGrid(workspace.id, anchor);
  const days = weekDays(anchor);
  const weekLabel = grid.weekStart.toISOString().slice(0, 10);

  const header = [
    'week_start',
    'week_end',
    'kind',
    'name',
    'role_or_trade',
    'status',
    ...days.map((d) => dayLabel(d, 'date')),
    'total_hours',
    'event_count',
    'open_count',
  ];

  const rows: string[][] = [header];
  for (const row of [...grid.employees, ...grid.subs]) {
    const dailyCsv = days.map((d, i) => {
      // Recompute day hours: the grid's
      // dailyHours array is for the same week so we
      // can index by i directly.
      const h = row.dailyHours[i];
      if (h === null) return '';
      return formatHours(h);
    });
    rows.push([
      weekLabel,
      new Date(grid.weekEnd.getTime() - 1).toISOString().slice(0, 10),
      row.kind,
      row.name,
      row.secondaryLabel ?? '',
      row.timesheetStatus ?? 'DRAFT',
      ...dailyCsv,
      formatHours(row.totalHours),
      String(row.dailyHours.filter((h) => h !== null).length),
      String(row.openCount),
    ]);
  }

  // Avoid unused-var warnings for the helpers we
  // imported but only use in derived code.
  void isSameLocalDay;

  const csv = toCsv(rows);
  const filename = `timesheets-workspace-${weekLabel}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: csvHeaders(filename, Buffer.byteLength(csv, 'utf8')),
  });
}
