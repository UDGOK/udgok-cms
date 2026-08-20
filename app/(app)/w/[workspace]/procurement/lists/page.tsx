import Link from 'next/link';
import { listMaterialLists } from '@/lib/procurement/list-queries';
import { requireMembership } from '@/lib/auth/require-membership';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-50/15 text-ink-50',
  QUOTING: 'bg-info/15 text-info',
  QUOTED: 'bg-orange/15 text-orange',
  CLOSED: 'bg-success/15 text-success',
};

export default async function MaterialListsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const lists = await listMaterialLists(workspace.id);

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link
            href={`/w/${workspace.slug}/procurement`}
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
          >
            ← Procurement
          </Link>
          <h1 className="text-2xl font-black mt-0.5">Material lists</h1>
          <p className="text-[12px] text-ink-70 mt-1 max-w-xl">
            A list is the cart — line items you want to buy. From a list, you send one RFQ per
            vendor and compare the quotes side-by-side.
          </p>
        </div>
        <Link
          href={`/w/${workspace.slug}/procurement/lists/new`}
          className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
        >
          + New list
        </Link>
      </div>

      {lists.length === 0 ? (
        <div className="bg-cream-2 border-2 border-line p-6 text-center">
          <div className="text-[13px] text-ink-50 mb-3">No material lists yet.</div>
          <Link
            href={`/w/${workspace.slug}/procurement/lists/new`}
            className="inline-block px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
          >
            + Build your first list
          </Link>
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-ink text-cream">
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Name
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Status
                </th>
                <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Lines
                </th>
                <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  RFQs
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Needed by
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-line last:border-b-0 hover:bg-cream-2 transition-colors"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`./${l.id}`}
                      className="font-extrabold text-ink hover:text-orange-d"
                    >
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                        STATUS_COLOR[l.status] ?? 'bg-ink-50/15 text-ink-50'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{l.lineCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{l.rfqCount}</td>
                  <td className="px-3 py-2 text-[10px] text-ink-50 font-mono">
                    {l.neededBy ? new Date(l.neededBy).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-ink-50 font-mono">
                    {new Date(l.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
