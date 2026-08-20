/**
 * Pending approvals list.
 *
 * URL: /w/[workspace]/timesheets/approvals
 *
 * Shows every SUBMITTED timesheet in the workspace,
 * most-recent-submission first. Each row has quick
 * Approve / Reject buttons (with inline reject note).
 * The link "Open timesheet" goes to the per-person
 * detail view.
 *
 * OWNER/ADMIN/PM only. FIELD / MEMBER / no role → 403.
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getPendingApprovals } from '@/lib/timesheets/queries';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { ApprovalsView } from '@/components/timesheets/ApprovalsView';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true, name: true },
  });
  if (!workspace) {
    return (
      <div className="p-6 text-[12px] font-mono text-error">Workspace not found.</div>
    );
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!membership) {
    return (
      <div className="p-6 text-[12px] font-mono text-error">Not a member of this workspace.</div>
    );
  }
  const master = await isMasterAdmin(userId);
  const canApprove = master || ['OWNER', 'ADMIN', 'PM'].includes(membership.role);
  if (!canApprove) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-paper border-2 border-warning p-5">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-warning font-extrabold">
            Forbidden
          </div>
          <div className="text-[14px] text-ink mt-1">
            Only owners, admins, and project managers can review timesheet approvals.
          </div>
        </div>
      </div>
    );
  }

  const pending = await getPendingApprovals(workspace.id);

  return (
    <ApprovalsView
      workspaceSlug={params.workspace}
      pending={pending.map((p) => ({
        id: p.id,
        personKind: p.personKind,
        personId: p.personId,
        personName: p.personName,
        personSecondary: p.personSecondary,
        weekStart: p.weekStart,
        weekEnd: p.weekEnd,
        totalHours: p.totalHours,
        eventCount: p.eventCount,
        submittedAt: p.submittedAt,
        submittedByName: p.submittedByName,
      }))}
    />
  );
}
