/**
 * New estimate page.
 *
 * URL: /w/[slug]/estimates/new?clientId=...&projectId=...&dealId=...
 *
 * Pre-fills the client / project / deal from query
 * params when present. The form (client component)
 * is the editor; this page just gathers the data
 * and renders it.
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { NewEstimateView } from '@/components/estimates/NewEstimateView';

export const dynamic = 'force-dynamic';

export default async function NewEstimatePage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { clientId?: string; projectId?: string; dealId?: string };
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
  const canDraft = master || ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR'].includes(membership.role);
  if (!canDraft) {
    return (
      <div className="p-6 text-[12px] font-mono text-error">
        Only owners, admins, project managers, and estimators can draft estimates.
      </div>
    );
  }

  const [clients, projects, deals] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { workspaceId: workspace.id, clientId: { not: null } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, clientId: true },
    }),
    prisma.deal.findMany({
      where: { workspaceId: workspace.id, stage: { in: ['LEAD', 'CONTACTED', 'NEGOTIATING'] } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, clientId: true },
    }),
  ]);

  return (
    <NewEstimateView
      workspaceSlug={params.workspace}
      clients={clients}
      projects={projects}
      deals={deals}
      prefill={{
        clientId: searchParams.clientId ?? null,
        projectId: searchParams.projectId ?? null,
        dealId: searchParams.dealId ?? null,
      }}
    />
  );
}
