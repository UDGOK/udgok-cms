/**
 * Per-employee timesheet detail.
 *
 * URL: /w/[workspace]/timesheets/employee/[userId]?week=...
 *
 * Renders PersonDetailView with all the user's
 * check-in events for the week, the daily grid,
 * and the edit / PDF controls.
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getEmployeeTimesheet } from '@/lib/timesheets/queries';
import { weekDays, effectiveHours } from '@/lib/timesheets/hours';
import { prisma } from '@/lib/db/client';
import { PersonDetailView } from '@/components/timesheets/PersonDetailView';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';

export default async function EmployeeTimesheetPage({
  params,
  searchParams,
}: {
  params: { workspace: string; userId: string };
  searchParams: { week?: string };
}) {
  const { userId: sessionUserId } = await auth();
  if (!sessionUserId) redirect('/sign-in');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true },
  });
  if (!workspace) {
    return (
      <div className="p-6 text-[12px] font-mono text-error">Workspace not found.</div>
    );
  }

  // Verify session is a member.
  const sessionMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: sessionUserId, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!sessionMembership) {
    return (
      <div className="p-6 text-[12px] font-mono text-error">Not a member of this workspace.</div>
    );
  }
  const master = await isMasterAdmin(sessionUserId);
  const canEdit = master || ['OWNER', 'ADMIN', 'PM'].includes(sessionMembership.role);
  // canSubmit: self always, plus approvers (so they
  // can submit on behalf of others).
  const canSubmit =
    master ||
    sessionMembership.role !== null ||
    params.userId === sessionUserId;
  // canApprove: OWNER/ADMIN/PM only.
  const canApprove = canEdit;

  // Resolve the anchor date for the week.
  let anchor = new Date();
  if (searchParams.week) {
    const d = new Date(searchParams.week);
    if (!Number.isNaN(d.getTime())) anchor = d;
  }

  const sheet = await getEmployeeTimesheet(workspace.id, params.userId, anchor);

  return (
    <PersonDetailView
      workspaceSlug={params.workspace}
      personId={params.userId}
      kind="employee"
      name={sheet.user.name}
      secondaryLabel={sheet.user.role}
      weekStart={sheet.weekStart.toISOString()}
      days={weekDays(anchor).map((d) => d.toISOString())}
      events={sheet.events.map((e) => ({
        id: e.id,
        projectId: e.projectId,
        projectName: e.projectName,
        projectCode: e.projectCode,
        siteLabel: e.siteLabel,
        checkedInAt: e.checkedInAt.toISOString(),
        checkedOutAt: e.checkedOutAt ? e.checkedOutAt.toISOString() : null,
        note: e.note,
        hours: e.hours,
        isOpen: e.isOpen,
        isEdited: e.isEdited,
        editedByName: e.editedByName,
        editedAt: e.editedAt ? e.editedAt.toISOString() : null,
        editNote: e.editNote,
        // The "system" hours (used for the "edited X but
        // system says Y" comparison line). We pass it
        // through so the edit modal can show "system
        // says X" inline.
        computedHours: effectiveHours({
          editedHours: null,
          checkedInAt: e.checkedInAt,
          checkedOutAt: e.checkedOutAt,
        }),
        editedHours: null, // not exposed on the EventRow
      }))}
      totalHours={sheet.totalHours}
      openCount={sheet.openCount}
      totalEvents={sheet.totalEvents}
      canEdit={canEdit}
      timesheet={sheet.timesheet}
      canSubmit={canSubmit}
      canApprove={canApprove}
    />
  );
}
