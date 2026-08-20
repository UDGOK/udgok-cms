import Link from 'next/link';
import { listItems } from '@/lib/procurement/items-queries';
import { requireMembership } from '@/lib/auth/require-membership';

export default async function ItemsPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { q?: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const items = await listItems(workspace.id, searchParams.q);

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
          <h1 className="text-2xl font-black mt-0.5">Item catalog</h1>
          <p className="text-[12px] text-ink-70 mt-1 max-w-xl">
            Things you buy repeatedly. Each priced quote line writes a price observation —
            that history is the long-term value. Material lists can also use free-text lines
            without an item record.
          </p>
        </div>
      </div>

      <form className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search description / SKU / mfr part…"
          className="flex-1 max-w-md px-3 py-2 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.12em]"
        >
          Search
        </button>
      </form>

      {items.length === 0 ? (
        <div className="bg-cream-2 border-2 border-line p-6 text-center text-[12px] text-ink-50">
          {searchParams.q
            ? 'No items match that search.'
            : 'No items in the catalog yet. Material lists can use free-text lines without an item record — start there, and add items as you find yourself typing the same description again.'}
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-ink text-cream">
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Description
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  SKU / Mfr#
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  UoM
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Default vendor
                </th>
                <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Price obs
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Last quoted
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 font-extrabold">{i.description}</td>
                  <td className="px-3 py-2 text-[10px] font-mono text-ink-50">
                    {i.sku ? <div>SKU: {i.sku}</div> : null}
                    {i.mfrPartNumber ? <div>Mfr: {i.mfrPartNumber}</div> : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{i.uom}</td>
                  <td className="px-3 py-2 text-[11px]">{i.defaultVendorName ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{i.priceCount}</td>
                  <td className="px-3 py-2 text-[10px] text-ink-50">
                    {i.lastQuotedAt ? new Date(i.lastQuotedAt).toLocaleDateString() : '—'}
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
