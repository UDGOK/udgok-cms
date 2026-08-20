/**
 * GET /api/timesheets/sub/[subId]/pdf
 *
 * Per-sub timesheet PDF. Mirrors the employee
 * route. Same auth + query params.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getSubTimesheet } from '@/lib/timesheets/queries';
import { weekDays, dayLabel } from '@/lib/timesheets/hours';
import { renderTimesheetPdf } from '@/lib/pdf/render-timesheet';

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
    return new NextResponse('Sub not found in workspace', { status: 404 });
  }

  const days = weekDays(anchor);
  try {
    const pdf = await renderTimesheetPdf({
      kind: 'sub',
      name: sheet.sub.name,
      secondaryLabel: sheet.sub.primaryTrade,
      weekStartLabel: sheet.weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      weekEndLabel: new Date(sheet.weekEnd.getTime() - 1).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      days: days.map((d) => ({
        label: dayLabel(d, 'short'),
        dateLabel: d.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
      })),
      events: sheet.events.map((e) => ({
        id: e.id,
        projectName: e.projectName,
        projectCode: e.projectCode,
        siteLabel: e.siteLabel,
        checkedInAt: e.checkedInAt,
        checkedOutAt: e.checkedOutAt,
        hours: e.hours,
        note: e.note,
        isOpen: e.isOpen,
        isEdited: e.isEdited,
        editNote: e.editNote,
      })),
      totalHours: sheet.totalHours,
      totalEvents: sheet.totalEvents,
      openCount: sheet.openCount,
      workspaceName: workspace.name,
      generatedAt: new Date(),
    });

    const filename = `timesheet-${sheet.sub.name.replace(/\s+/g, '_')}-${sheet.weekStart.toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdf.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[timesheet pdf] render failed:', err);
    return new NextResponse('Failed to render PDF', { status: 500 });
  }
}
