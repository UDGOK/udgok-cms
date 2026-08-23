import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { listAllRfqs } from '@/lib/procurement/rfq-list-queries';
import { fmtDate } from '@/lib/format/currency';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-50/15 text-ink-50',
  SENT: 'bg-info/15 text-info',
  VIEWED: 'bg-info/15 text-info',
  RESPONDED: 'bg-orange/15 text-orange',
  ACCEPTED: 'bg-success/15 text-success',
  DECLINED: 'bg-error/15 text-error',
  CANCELLED: 'bg-ink-50/15 text-ink-50',
  EXPIRED: 'bg-error/15 text-error',
  SUPERSEDED: 'bg-ink-50/15 text-ink-50',
  REVOKED: 'bg-ink-50/15 text-ink-50',
};

export const dynamic = 'force-dynamic';

export default async function AllRfqsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const rfqs = await listAllRfqs(workspace.id);

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← Procurement
      </Link>
      <h1 className="text-2xl font-black mt-0.5 mb-4">All RFQs</h1>

      {rfqs.length === 0 ? (
        <div className="bg-cream-2 border-2 border-line p-6 text-center text-[12px] text-ink-50">
          No RFQs yet. Send one from a material list.
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
                  Vendor / list
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Status
                </th>
                <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Total
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Sent
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-line last:border-b-0 hover:bg-cream-2 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-[10px]">
                    <Link
                      href={`/w/${workspace.slug}/procurement/rfqs/${r.id}`}
                      className="hover:text-orange-d"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-extrabold">{r.vendor.name}</div>
                    <div className="text-[10px] text-ink-50 font-mono">{r.listName}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                        STATUS_COLOR[r.status] ?? 'bg-ink-50/15 text-ink-50'
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.firstViewedAt && !r.respondedAt ? (
                      <span className="ml-1 text-[9px] text-ink-50 font-mono">opened</span>
                    ) : null}
                    {r.hasPo ? (
                      <span className="ml-1 px-1.5 py-0.5 bg-success/15 text-success text-[9px] font-extrabold uppercase tracking-[0.1em]">
                        PO
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.total != null ? `$${r.total.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-ink-50 font-mono">
                    {r.sentAt ? fmtDate(r.sentAt) : '—'}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-ink-50 font-mono">
                    {fmtDate(r.expiresAt)}
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
