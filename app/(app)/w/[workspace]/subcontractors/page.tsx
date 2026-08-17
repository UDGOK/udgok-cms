import { requireMembership } from '@/lib/auth/require-membership';
import { listSubcontractors } from '@/lib/subs/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { SubsListClient } from './SubsListClient';
import { CSI_MASTERFORMAT } from '@/lib/construction/csi-masterformat';

export const dynamic = 'force-dynamic';

export default async function SubcontractorsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const ctx = await requireMembership(params.workspace);
  const subs = await listSubcontractors(ctx.workspace.id);

  // Build a lookup of CSI number → name for the filter
  const csiLookup: Record<string, string> = {};
  for (const d of CSI_MASTERFORMAT) csiLookup[d.number] = d.name;

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Subcontractors"
        subtitle="Your vetted vendor library. Assign them to projects and the trades they cover."
        breadcrumbs={[{ label: ctx.workspace.name, href: `/w/${ctx.workspace.slug}/dashboard` }, { label: 'Subcontractors' }]}
      />

      <SubsListClient
        workspaceSlug={ctx.workspace.slug}
        initialSubs={subs.map((s) => ({
          ...s,
          insuranceExpiry: s.insuranceExpiry?.toISOString() ?? null,
        }))}
        csiLookup={csiLookup}
      />
    </div>
  );
}
