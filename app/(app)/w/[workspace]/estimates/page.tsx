/**
 * Estimates list page. Shows every estimate in the
 * workspace, with filters by status + client.
 *
 * URL: /w/[slug]/estimates?status=&clientId=
 *
 * Each row links to the detail page. The list also
 * surfaces a "+ New estimate" CTA at the top.
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getEstimates } from '@/lib/estimates/queries';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { EstimatesView } from '@/components/estimates/EstimatesView';

export const dynamic = 'force-dynamic';

export default async function EstimatesPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { status?: string; clientId?: string };
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

  const validStatuses = ['DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED', 'CONVERTED'] as const;
  const status = (validStatuses as readonly string[]).includes(searchParams.status ?? '')
    ? (searchParams.status as (typeof validStatuses)[number])
    : undefined;

  const [estimates, clients] = await Promise.all([
    getEstimates(workspace.id, { status, clientId: searchParams.clientId }),
    prisma.client.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <EstimatesView
      workspaceSlug={params.workspace}
      canEdit={master || ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR'].includes(membership.role)}
      estimates={estimates}
      clients={clients}
      status={status ?? null}
      clientId={searchParams.clientId ?? null}
    />
  );
}
