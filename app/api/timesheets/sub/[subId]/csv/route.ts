/**
 * GET /api/timesheets/sub/[subId]/csv
 *
 * Per-sub timesheet CSV. Same shape as the employee
 * route with kind=sub and primary_trade instead of
 * role.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getSubTimesheet } from '@/lib/timesheets/queries';
import { formatHours } from '@/lib/timesheets/hours';
import { toCsv, csvHeaders } from '@/lib/timesheets/csv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: { subId: string } },
) {
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

  const sheet = await getSubTimesheet(workspace.id, params.subId, anchor);
  if (sheet.sub.id !== params.subId) {
    return new NextResponse('Sub not found', { status: 404 });
  }

  const weekLabel = sheet.weekStart.toISOString().slice(0, 10);
  const header = [
    'week_start',
    'week_end',
    'date',
    'subcontractor',
    'kind',
    'primary_trade',
    'project',
    'project_code',
    'site_label',
    'checked_in',
    'checked_out',
    'hours',
    'is_open',
    'is_edited',
    'edit_note',
    'edited_by',
    'status',
    'submitted_by',
    'approved_by',
  ];

  const rows: string[][] = [header];
  for (const e of sheet.events) {
    rows.push([
      weekLabel,
      new Date(sheet.weekEnd.getTime() - 1).toISOString().slice(0, 10),
      e.checkedInAt.toISOString().slice(0, 10),
      sheet.sub.name,
      'sub',
      sheet.sub.primaryTrade ?? '',
      e.projectName,
      e.projectCode ?? '',
      e.siteLabel ?? '',
      e.checkedInAt.toISOString(),
      e.checkedOutAt ? e.checkedOutAt.toISOString() : '',
      e.hours !== null ? formatHours(e.hours) : '',
      e.isOpen ? 'yes' : 'no',
      e.isEdited ? 'yes' : 'no',
      e.isEdited && e.editNote ? e.editNote : '',
      e.editedByName ?? '',
      sheet.timesheet?.status ?? 'DRAFT',
      sheet.timesheet?.submittedByName ?? '',
      sheet.timesheet?.approvedByName ?? '',
    ]);
  }

  const csv = toCsv(rows);
  const filename = `timesheet-${sheet.sub.name.replace(/\s+/g, '_')}-${weekLabel}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: csvHeaders(filename, Buffer.byteLength(csv, 'utf8')),
  });
}
