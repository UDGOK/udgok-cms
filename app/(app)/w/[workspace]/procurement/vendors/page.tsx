import { listVendors } from '@/lib/procurement/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import Link from 'next/link';
import { VendorsList } from './VendorsList';

/**
 * Vendors list — Phase 1.
 *
 * Read-only with an "Add vendor" button. Detail / edit /
 * archive + contacts live under /vendors/[id].
 */
export default async function VendorsPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { q?: string; status?: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const items = await listVendors(workspace.id);
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const status = searchParams.status ?? '';
  const filtered = items.filter((v) => {
    if (q && !v.name.toLowerCase().includes(q)) return false;
    if (status && v.status !== status) return false;
    return true;
  });

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
          <h1 className="text-2xl font-black mt-0.5">Vendors</h1>
          <p className="text-[12px] text-ink-70 mt-1">
            Suppliers, reps, and their contacts. Magic-link RFQs are sent to a contact&apos;s email —
            they don&apos;t log in.
          </p>
        </div>
        <Link
          href={`/w/${workspace.slug}/procurement/vendors/new`}
          className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
        >
          + Add vendor
        </Link>
      </div>

      <form className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search by name…"
          className="flex-1 max-w-xs px-3 py-2 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
        />
        <select
          name="status"
          defaultValue={status}
          className="px-3 py-2 bg-paper border border-line text-ink text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button
          type="submit"
          className="px-3 py-2 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.12em]"
        >
          Filter
        </button>
      </form>

      <VendorsList items={filtered} />
    </div>
  );
}
