import { requireMembership } from '@/lib/auth/require-membership';
import Link from 'next/link';
import { NewListForm } from './NewListForm';

export default async function NewListPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement/lists`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Material lists
      </Link>
      <h1 className="text-2xl font-black mt-0.5 mb-4">New material list</h1>
      <NewListForm
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
      />
    </div>
  );
}
