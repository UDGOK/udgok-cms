import { fmtDate } from '@/lib/format/currency';
/**
 * GET /api/timesheets/employee/[userId]/pdf
 *
 * Returns the weekly timesheet PDF for the given
 * user. Auth: any workspace member can fetch
 * another member's timesheet. The route validates
 * workspace membership server-side.
 *
 * Query params:
 *   - week: ISO date (any day in the target week;
 *           defaults to today)
 *   - slug: workspace slug (required; the URL
 *           doesn't include the workspace so the
 *           link is shorter, but a multi-workspace
 *           user might be in both — slug disam-
 *           biguates)
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getEmployeeTimesheet } from '@/lib/timesheets/queries';
import { weekDays, dayLabel, formatHours } from '@/lib/timesheets/hours';
import { renderTimesheetPdf } from '@/lib/pdf/render-timesheet';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: { userId: string } },
) {
  const { userId: sessionUserId } = await auth();
  if (!sessionUserId) {
    return new NextResponse('Not signed in', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) {
    return new NextResponse('Missing slug', { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!workspace) return new NextResponse('Workspace not found', { status: 404 });

  // Confirm the session is a member.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: sessionUserId, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  // Resolve the week anchor.
  let anchor = new Date();
  if (searchParams.get('week')) {
    const d = new Date(searchParams.get('week')!);
    if (!Number.isNaN(d.getTime())) anchor = d;
  }

  const sheet = await getEmployeeTimesheet(workspace.id, params.userId, anchor);
  if (sheet.user.id !== params.userId) {
    return new NextResponse('User not found in workspace', { status: 404 });
  }

  // Map to the PDF data shape.
  const days = weekDays(anchor);
  try {
    const pdf = await renderTimesheetPdf({
      kind: 'employee',
      name: sheet.user.name,
      secondaryLabel: sheet.user.role,
      weekStartLabel: fmtDate(sheet.weekStart),
      weekEndLabel: new Date(sheet.weekEnd.getTime() - 1).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      days: days.map((d) => ({
        label: dayLabel(d, 'short'),
        dateLabel: fmtDate(d),
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

    const filename = `timesheet-${sheet.user.name.replace(/\s+/g, '_')}-${sheet.weekStart.toISOString().slice(0, 10)}.pdf`;
    // Avoid the unused-import warning for formatHours
    // (used elsewhere in the codebase).
    void formatHours;

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
