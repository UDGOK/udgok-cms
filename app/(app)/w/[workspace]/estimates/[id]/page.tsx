/**
 * Estimate detail page.
 *
 * URL: /w/[slug]/estimates/[id]
 *
 * Shows the full estimate with line items, the
 * status / approval audit, and the action bar
 * (Send, Convert to project, Void) depending on
 * state. Includes the shareable public URL once
 * the estimate is SENT.
 */

import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getEstimate } from '@/lib/estimates/queries';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { EstimateDetailView } from '@/components/estimates/EstimateDetailView';

export const dynamic = 'force-dynamic';

export default async function EstimateDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true },
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
  const canEdit = master || ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR'].includes(membership.role);
  const canConvert = master || ['OWNER', 'ADMIN', 'PM'].includes(membership.role);

  const estimate = await getEstimate(workspace.id, params.id);
  if (!estimate) notFound();

  return (
    <EstimateDetailView
      workspaceSlug={params.workspace}
      estimate={estimate}
      canEdit={canEdit}
      canConvert={canConvert}
    />
  );
}
