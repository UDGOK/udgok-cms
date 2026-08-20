import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import Link from 'next/link';

/**
 * Procurement dashboard.
 *
 * Phase 1 surfaces a small status panel — vendor count,
 * active RFQs, recent POs — plus quick-action links to
 * the vendor list, material list builder, and items
 * catalog. Phase 2 will add the open-RFQs feed and
 * awaiting-response card.
 */
export default async function ProcurementDashboardPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const [vendorCount, activeVendorCount, itemCount, listCount, openListCount, poCount] =
    await Promise.all([
      prisma.vendor.count({ where: { workspaceId: workspace.id, deletedAt: null } }),
      prisma.vendor.count({ where: { workspaceId: workspace.id, status: 'ACTIVE', deletedAt: null } }),
      prisma.item.count({ where: { workspaceId: workspace.id, active: true } }),
      prisma.materialList.count({ where: { workspaceId: workspace.id, deletedAt: null } }),
      prisma.materialList.count({
        where: { workspaceId: workspace.id, status: { in: ['DRAFT', 'QUOTING', 'QUOTED'] }, deletedAt: null },
      }),
      prisma.purchaseOrder.count({ where: { workspaceId: workspace.id } }),
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Stat label="Vendors" value={vendorCount} sub={`${activeVendorCount} active`} href={`${base}/vendors`} />
        <Stat label="Items" value={itemCount} sub="in catalog" href={`${base}/items`} />
        <Stat label="Material lists" value={listCount} sub={`${openListCount} open`} href={`${base}/lists`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
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
          href={`${base}/lists`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Material lists'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">{openListCount} open</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Build / request quotes →
          </div>
        </Link>
      </div>

      <div className="bg-cream-2 border-2 border-line p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
          {'// Phase 1 — what works now'}
        </div>
        <ul className="text-[12px] text-ink-70 space-y-1 list-disc list-inside">
          <li>Add vendors (Locke, Broken Arrow Electric, Lowe&apos;s, Home Depot as a starting set)</li>
          <li>Build the items catalog (optional — free-text lines always work)</li>
          <li>Build a material list and add line items</li>
        </ul>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mt-4 mb-1">
          {'// Phase 2 — next up'}
        </div>
        <ul className="text-[12px] text-ink-50 space-y-1 list-disc list-inside">
          <li>Send an RFQ to a vendor (tokenised magic link, no login)</li>
          <li>Vendor types prices, lead time, substitutions</li>
          <li>Compare quotes side-by-side, accept, generate PO</li>
          <li>Price history (the moat — every priced line is recorded)</li>
        </ul>
        {poCount > 0 ? (
          <div className="mt-3 text-[10px] font-mono text-ink-50">
            {poCount} PO{poCount === 1 ? '' : 's'} on file.
          </div>
        ) : null}
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
