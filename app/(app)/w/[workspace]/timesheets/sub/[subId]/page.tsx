/**
 * Per-sub timesheet detail. Same shape as the
 * per-employee page but keyed off subcontractorId.
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getSubTimesheet } from '@/lib/timesheets/queries';
import { weekDays, effectiveHours } from '@/lib/timesheets/hours';
import { prisma } from '@/lib/db/client';
import { PersonDetailView } from '@/components/timesheets/PersonDetailView';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';

export default async function SubTimesheetPage({
  params,
  searchParams,
}: {
  params: { workspace: string; subId: string };
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

  let anchor = new Date();
  if (searchParams.week) {
    const d = new Date(searchParams.week);
    if (!Number.isNaN(d.getTime())) anchor = d;
  }

  const sheet = await getSubTimesheet(workspace.id, params.subId, anchor);

  return (
    <PersonDetailView
      workspaceSlug={params.workspace}
      personId={params.subId}
      kind="sub"
      name={sheet.sub.name}
      secondaryLabel={sheet.sub.primaryTrade}
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
        computedHours: effectiveHours({
          editedHours: null,
          checkedInAt: e.checkedInAt,
          checkedOutAt: e.checkedOutAt,
        }),
        editedHours: null,
      }))}
      totalHours={sheet.totalHours}
      openCount={sheet.openCount}
      totalEvents={sheet.totalEvents}
      canEdit={canEdit}
    />
  );
}
