import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { listAllPos } from '@/lib/procurement/po-queries';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-50/15 text-ink-50',
  PENDING_APPROVAL: 'bg-warning/15 text-warning',
  ISSUED: 'bg-info/15 text-info',
  ACKNOWLEDGED: 'bg-info/15 text-info',
  RECEIVED: 'bg-success/15 text-success',
  CLOSED: 'bg-success/15 text-success',
  CANCELLED: 'bg-ink-50/15 text-ink-50',
};

export const dynamic = 'force-dynamic';

export default async function AllPosPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const pos = await listAllPos(workspace.id);

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Procurement
      </Link>
      <h1 className="text-2xl font-black mt-0.5 mb-4">Purchase orders</h1>

      {pos.length === 0 ? (
        <div className="bg-cream-2 border-2 border-line p-6 text-center text-[12px] text-ink-50">
          No POs yet. Accept a quote to create one.
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-ink text-cream">
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Number
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Vendor
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Status
                </th>
                <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Lines
                </th>
                <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Total
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Issued
                </th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-line last:border-b-0 hover:bg-cream-2 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-[10px]">
                    <Link
                      href={`/w/${workspace.slug}/procurement/pos/${p.id}`}
                      className="hover:text-orange-d"
                    >
                      {p.number}
                    </Link>
                    {p.rfqNumber ? (
                      <div className="text-[9px] text-ink-50 font-mono">← {p.rfqNumber}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-extrabold">{p.vendor.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                        STATUS_COLOR[p.status] ?? 'bg-ink-50/15 text-ink-50'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{p.lineCount}</td>
                  <td className="px-3 py-2 text-right font-mono font-extrabold">
                    ${p.total.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-ink-50 font-mono">
                    {p.issuedAt ? p.issuedAt.toLocaleDateString() : '—'}
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
