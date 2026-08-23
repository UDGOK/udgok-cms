/**
 * Project Change Orders list page.
 *
 * The workhorse view for the CO feature. Shows every CO on the
 * project in a table, with status, AIA G701 line items, and
 * one-click submit/withdraw. The "+ New change order" button
 * opens a modal.
 *
 * Extracted from the public vendor-portal pattern (PO + RFQ) —
 * same DOM, different data source.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { listChangeOrders } from '@/lib/change-orders/queries';
import { ChangeOrdersTable } from './ChangeOrdersTable';
import { NewChangeOrderButton } from './NewChangeOrderButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-30 text-ink',
  SUBMITTED: 'bg-warning text-ink',
  UNDER_REVIEW: 'bg-warning text-ink',
  PARTIALLY_APPROVED: 'bg-warning text-ink',
  REVISED: 'bg-ink-30 text-ink',
  APPROVED: 'bg-success text-paper',
  INCLUDED_IN_PAY_APP: 'bg-success text-paper',
  REJECTED: 'bg-error text-paper',
  WITHDRAWN: 'bg-ink-30 text-ink',
  SUPERSEDED: 'bg-ink-30 text-ink',
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

export default async function ProjectChangeOrdersPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      contractValue: true,
      divisions: { select: { id: true, code: true, trade: true, budget: true } },
    },
  });
  if (!project) notFound();

  const cos = await listChangeOrders(project.id, workspace.id);
  const pendingCount = cos.filter(
    (c) =>
      c.status === 'SUBMITTED' ||
      c.status === 'UNDER_REVIEW' ||
      c.status === 'PARTIALLY_APPROVED' ||
      c.status === 'REVISED',
  ).length;
  const approvedTotal = cos
    .filter((c) => c.status === 'APPROVED' || c.status === 'INCLUDED_IN_PAY_APP')
    .reduce((acc, c) => acc + c.thisCOAmount, 0);
  const contractValue = project.contractValue ? Number(project.contractValue) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Orders"
        subtitle="AIA G701 / G702 — contract amendments signed by owner and architect"
        breadcrumbs={[
          { label: project.name, href: `/w/${params.workspace}/projects/${params.id}` },
          { label: 'Change orders' },
        ]}
        actions={
          <NewChangeOrderButton
            projectId={project.id}
            workspaceSlug={params.workspace}
            contractValue={contractValue}
            divisions={project.divisions.map((d) => ({
              id: d.id,
              code: d.code,
              trade: d.trade,
              budget: Number(d.budget),
            }))}
          />
        }
      />
      <MobilePageHeader title="Change Orders" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Original contract</div>
          <div className="text-2xl font-extrabold tabular-nums">{fmtUsd(contractValue)}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Approved COs total</div>
          <div className="text-2xl font-extrabold tabular-nums">{fmtUsd(approvedTotal)}</div>
        </div>
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-60 font-mono">Awaiting signature</div>
          <div className="text-2xl font-extrabold tabular-nums">{pendingCount}</div>
        </div>
      </div>

      <ChangeOrdersTable
        cos={cos}
        workspaceSlug={params.workspace}
        projectId={project.id}
        statusColor={STATUS_COLOR}
      />

      {cos.length === 0 ? (
        <div className="bg-paper border-2 border-dashed border-ink-30 p-8 text-center">
          <h3 className="font-bold mb-2">No change orders yet</h3>
          <p className="text-ink-70 text-sm mb-4">
            A change order captures scope, schedule, or pricing changes after the
            contract is signed. Each one needs owner + architect sign-off before
            the contract sum moves.
          </p>
          <NewChangeOrderButton
            projectId={project.id}
            workspaceSlug={params.workspace}
            contractValue={contractValue}
            divisions={project.divisions.map((d) => ({
              id: d.id,
              code: d.code,
              trade: d.trade,
              budget: Number(d.budget),
            }))}
            primary
          />
        </div>
      ) : null}
    </div>
  );
}
