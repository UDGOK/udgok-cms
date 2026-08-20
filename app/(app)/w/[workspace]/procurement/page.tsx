import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import Link from 'next/link';

/**
 * Procurement dashboard.
 *
 * Phase 2 surfaces:
 *   - vendor count (active)
 *   - items catalog count
 *   - material lists (open)
 *   - open RFQs (DRAFT/SENT/VIEWED — waiting for vendor)
 *   - responded RFQs (need to compare/accept)
 *   - POs pending approval
 *   - POs issued
 *   - quick links + recent activity
 */
export const dynamic = 'force-dynamic';

export default async function ProcurementDashboardPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const [
    vendorCount,
    activeVendorCount,
    itemCount,
    listCount,
    openListCount,
    awaitingResponseCount,
    respondedCount,
    pendingPoCount,
    issuedPoCount,
    recentRfqs,
    recentPos,
  ] = await Promise.all([
    prisma.vendor.count({ where: { workspaceId: workspace.id, deletedAt: null } }),
    prisma.vendor.count({ where: { workspaceId: workspace.id, status: 'ACTIVE', deletedAt: null } }),
    prisma.item.count({ where: { workspaceId: workspace.id, active: true } }),
    prisma.materialList.count({ where: { workspaceId: workspace.id, deletedAt: null } }),
    prisma.materialList.count({
      where: { workspaceId: workspace.id, status: { in: ['DRAFT', 'QUOTING', 'QUOTED'] }, deletedAt: null },
    }),
    prisma.rfq.count({
      where: { workspaceId: workspace.id, status: { in: ['DRAFT', 'SENT', 'VIEWED'] } },
    }),
    prisma.rfq.count({
      where: { workspaceId: workspace.id, status: 'RESPONDED' },
    }),
    prisma.purchaseOrder.count({
      where: { workspaceId: workspace.id, status: 'PENDING_APPROVAL' },
    }),
    prisma.purchaseOrder.count({
      where: { workspaceId: workspace.id, status: 'ISSUED' },
    }),
    prisma.rfq.findMany({
      where: { workspaceId: workspace.id, status: { in: ['SENT', 'VIEWED', 'RESPONDED'] } },
      orderBy: [{ status: 'asc' }, { sentAt: 'desc' }],
      take: 5,
      include: {
        vendor: { select: { name: true } },
        list: { select: { name: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { workspaceId: workspace.id, status: { in: ['PENDING_APPROVAL', 'ISSUED'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        vendor: { select: { name: true } },
      },
    }),
  ]);

  const base = `/w/${workspace.slug}/procurement`;

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <div className="mb-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
          Procurement
        </div>
        <h1 className="text-2xl font-black mt-0.5">Buy the right thing, from the right vendor.</h1>
        <p className="text-[13px] text-ink-70 mt-2 max-w-2xl">
          Material lists, RFQs to vendors (no login required on their end — magic link), quote
          comparison, and POs. Money is recomputed server-side; line items are append-only price
          history.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Vendors" value={vendorCount} sub={`${activeVendorCount} active`} href={`${base}/vendors`} />
        <Stat label="Material lists" value={openListCount} sub={`${listCount} total`} href={`${base}/lists`} />
        <Stat label="Open RFQs" value={awaitingResponseCount} sub="awaiting reply" href={`${base}/rfqs`} />
        <Stat
          label={pendingPoCount > 0 ? 'POs need approval' : 'Issued POs'}
          value={pendingPoCount > 0 ? pendingPoCount : issuedPoCount}
          sub={pendingPoCount > 0 ? 'pending issue' : 'to vendors'}
          href={`${base}/pos`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-paper border-2 border-ink p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            Awaiting response
          </div>
          {recentRfqs.length === 0 ? (
            <div className="text-[11px] text-ink-50">No open RFQs. Send one from a material list.</div>
          ) : (
            <ul className="divide-y divide-line">
              {recentRfqs.map((r) => (
                <li
                  key={r.id}
                  className="py-1.5 first:pt-0 last:pb-0 flex items-center gap-2 text-[12px]"
                >
                  <span className="font-mono text-[10px] text-ink-50 w-20">{r.number}</span>
                  <Link
                    href={`/w/${workspace.slug}/procurement/rfqs/${r.id}`}
                    className="font-extrabold flex-1 min-w-0 truncate hover:text-orange-d"
                  >
                    {r.vendor.name} — {r.list.name}
                  </Link>
                  <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em]">
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {respondedCount > 0 ? (
            <div className="mt-2 text-[10px] text-orange-d font-extrabold">
              {respondedCount} RFQ{respondedCount === 1 ? '' : 's'} ready to compare →
            </div>
          ) : null}
        </div>

        <div className="bg-paper border-2 border-ink p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            POs
          </div>
          {recentPos.length === 0 ? (
            <div className="text-[11px] text-ink-50">No POs yet. Accept a quote to create one.</div>
          ) : (
            <ul className="divide-y divide-line">
              {recentPos.map((p) => (
                <li
                  key={p.id}
                  className="py-1.5 first:pt-0 last:pb-0 flex items-center gap-2 text-[12px]"
                >
                  <span className="font-mono text-[10px] text-ink-50 w-20">{p.number}</span>
                  <Link
                    href={`/w/${workspace.slug}/procurement/pos/${p.id}`}
                    className="font-extrabold flex-1 min-w-0 truncate hover:text-orange-d"
                  >
                    {p.vendor.name}
                  </Link>
                  <span className="font-mono">${Number(p.total).toLocaleString()}</span>
                  <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em]">
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Link
          href={`${base}/lists`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Lists'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">{openListCount} open</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Build / request quotes →
          </div>
        </Link>
        <Link
          href={`${base}/vendors`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Vendors'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">{vendorCount} on file</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Manage vendors →
          </div>
        </Link>
        <Link
          href={`${base}/items`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Items'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">{itemCount} in catalog</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Price history (the moat) →
          </div>
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
        {`// ${label}`}
      </div>
      <div className="text-3xl font-black mt-1">{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1">
        {sub}
      </div>
    </Link>
  );
}
