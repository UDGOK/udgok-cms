import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { getCompareForList } from '@/lib/procurement/compare-queries';
import { CompareView } from './CompareView';

export const dynamic = 'force-dynamic';

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { list?: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  if (!searchParams.list) notFound();
  const data = await getCompareForList(workspace.id, searchParams.list);
  if (!data) notFound();

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement/lists/${data.list.id}`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← {data.list.name}
      </Link>
      <h1 className="text-2xl font-black mt-0.5 mb-2">Compare quotes</h1>
      <p className="text-[12px] text-ink-70 mb-4 max-w-2xl">
        Green ★ marks the lowest price for each line. Pick one cell per line, then click
        &quot;Award&quot; — we&apos;ll create one PO per vendor (so a mixed selection makes multiple POs).
      </p>
      <CompareView
        data={data}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
      />
    </div>
  );
}
