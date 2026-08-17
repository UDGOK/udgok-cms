import { notFound } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { getSubcontractor } from '@/lib/subs/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { SubEditor } from './SubEditor';

export const dynamic = 'force-dynamic';

export default async function EditSubPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const ctx = await requireMembership(params.workspace);
  const sub = await getSubcontractor(ctx.workspace.id, params.id);
  if (!sub) notFound();

  return (
    <div className="px-10 py-8 max-w-4xl">
      <PageHeader
        title={`Edit ${sub.name}`}
        breadcrumbs={[
          { label: ctx.workspace.name, href: `/w/${ctx.workspace.slug}/dashboard` },
          { label: 'Subcontractors', href: `/w/${ctx.workspace.slug}/subcontractors` },
          { label: sub.name, href: `/w/${ctx.workspace.slug}/subcontractors/${sub.id}` },
          { label: 'Edit' },
        ]}
      />

      <SubEditor
        workspaceSlug={ctx.workspace.slug}
        subId={sub.id}
        initial={{
          name: sub.name,
          primaryTrade: sub.primaryTrade,
          contactName: sub.contactName,
          contactEmail: sub.contactEmail,
          contactPhone: sub.contactPhone,
          address: sub.address,
          licenseNumber: sub.licenseNumber,
          insuranceExpiry: sub.insuranceExpiry?.toISOString().slice(0, 10) ?? '',
          hourlyRate: sub.hourlyRate,
          notes: sub.notes,
          w9OnFile: sub.w9OnFile,
          rating: sub.rating,
        }}
      />
    </div>
  );
}
