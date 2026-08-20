import { requireMembership } from '@/lib/auth/require-membership';
import Link from 'next/link';
import { NewVendorForm } from './NewVendorForm';
import { PILOT_VENDORS } from '@/lib/procurement/types';

export default async function NewVendorPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement/vendors`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Vendors
      </Link>
      <h1 className="text-2xl font-black mt-0.5 mb-4">Add vendor</h1>

      <div className="bg-cream-2 border border-line p-3 mb-4 text-[11px] text-ink-70">
        <div className="font-extrabold uppercase tracking-[0.1em] text-ink-50 mb-1 text-[10px] font-mono">
          Quick start — pilot vendors
        </div>
        We&apos;re piloting with a small set. Click a name to prefill:
        <div className="flex flex-wrap gap-2 mt-2">
          {PILOT_VENDORS.map((p) => (
            <a
              key={p.name}
              href={`?prefill=${encodeURIComponent(p.name)}`}
              className="px-2 py-1 bg-paper border border-line text-[11px] font-extrabold uppercase tracking-[0.1em] hover:border-ink"
            >
              {p.name}
            </a>
          ))}
        </div>
      </div>

      <NewVendorForm
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        prefillName={null}
      />
    </div>
  );
}
