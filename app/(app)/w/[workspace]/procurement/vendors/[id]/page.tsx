import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { getVendorDetail } from '@/lib/procurement/queries';
import { VendorDetailView } from './VendorDetailView';

export default async function VendorDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const vendor = await getVendorDetail(workspace.id, params.id);
  if (!vendor) notFound();

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement/vendors`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Vendors
      </Link>
      <VendorDetailView
        vendor={vendor}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
      />
    </div>
  );
}
