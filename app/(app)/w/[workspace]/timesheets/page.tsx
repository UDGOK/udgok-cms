/**
 * Timesheets — workspace-wide weekly grid.
 *
 * Query params:
 *   - week: ISO date (any day in the target week;
 *           we anchor on its Monday)
 *
 * Server component. Renders the TimesheetsView
 * client component with all data fetched in this
 * request.
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { weekDays } from '@/lib/timesheets/hours';
import { getWeeklyGrid, getOpenCheckIns } from '@/lib/timesheets/queries';
import { prisma } from '@/lib/db/client';
import { TimesheetsView } from '@/components/timesheets/TimesheetsView';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';

export default async function TimesheetsPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { week?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true },
  });
  if (!workspace) {
    return (
      <div className="p-6 text-[12px] font-mono text-error">
        Workspace not found.
      </div>
    );
  }

  // Verify membership.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!membership) {
    return (
      <div className="p-6 text-[12px] font-mono text-error">
        Not a member of this workspace.
      </div>
    );
  }

  // Permission to edit / close: OWNER / ADMIN / PM.
  // (master admin is also implicitly allowed via the
  // data layer, but we check the role directly here
  // for the canEdit flag in the UI.)
  const master = await isMasterAdmin(userId);
  const canEdit = master || ['OWNER', 'ADMIN', 'PM'].includes(membership.role);

  // Resolve the anchor date. Default = today.
  let anchor = new Date();
  if (searchParams.week) {
    const d = new Date(searchParams.week);
    if (!Number.isNaN(d.getTime())) anchor = d;
  }

  const [grid, openCheckIns] = await Promise.all([
    getWeeklyGrid(workspace.id, anchor),
    getOpenCheckIns(workspace.id),
  ]);

  return (
    <TimesheetsView
      workspaceSlug={params.workspace}
      weekStart={grid.weekStart.toISOString()}
      days={weekDays(anchor).map((d) => d.toISOString())}
      employees={grid.employees}
      subs={grid.subs}
      employeeTotalHours={grid.employeeTotalHours}
      subTotalHours={grid.subTotalHours}
      openCheckIns={openCheckIns.map((e) => ({
        id: e.id,
        projectId: e.projectId,
        projectName: e.projectName,
        whoName: e.whoName,
        whoKind: e.whoKind,
        checkedInAt: e.checkedInAt.toISOString(),
        hoursOpen: e.hoursOpen,
        siteLabel: e.siteLabel,
      }))}
      canEdit={canEdit}
    />
  );
}
