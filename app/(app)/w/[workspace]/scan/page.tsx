import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScanPageClient } from './ScanPageClient';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { listRecentScansForWorkspace } from '@/lib/scans/queries';
import { listActiveProjectsForInventory } from '@/lib/inventory/queries';
import { CreateInventoryFromScan } from './CreateInventoryFromScan';
import { lookupProduct } from '@/lib/products/lookup';

export const dynamic = 'force-dynamic';

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { code?: string };
}) {
  const { workspace, userId } = await requireMembership(params.workspace);
  const master = await isMasterAdmin(userId);

  // If a code was passed, look it up in the workspace and PERSIST
  // the scan as a ScanEvent. The persistence is what gives the
  // user a "Recent scans" list and an audit trail. The lookup
  // matches against the entity's id OR its name (case-insensitive).
  let lookup: { type: 'sub' | 'project' | 'client' | 'file' | 'none'; label: string; href: string } = {
    type: 'none',
    label: '',
    href: '',
  };
  if (searchParams.code) {
    const code = searchParams.code;
    // Three parallel lookups: the local sub/project/client
    // tables, and (if none of those match) a product-catalog
    // lookup that hits the workspace's cached products first
    // then falls through to UPCitemdb / Open Food Facts.
    const [sub, project, client] = await Promise.all([
      prisma.subcontractor.findFirst({
        where: { workspaceId: workspace.id, OR: [{ id: code }, { name: { contains: code, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      }),
      prisma.project.findFirst({
        where: { workspaceId: workspace.id, OR: [{ id: code }, { name: { contains: code, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      }),
      prisma.client.findFirst({
        where: { workspaceId: workspace.id, OR: [{ id: code }, { name: { contains: code, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      }),
    ]);
    if (sub) {
      lookup = { type: 'sub', label: sub.name, href: `/w/${workspace.slug}/subcontractors/${sub.id}` };
    } else if (project) {
      lookup = { type: 'project', label: project.name, href: `/w/${workspace.slug}/projects/${project.id}` };
    } else if (client) {
      lookup = { type: 'client', label: client.name, href: `/w/${workspace.slug}/clients/${client.id}` };
    }

    // Persist the scan. We don't fail the request if this write
    // throws — the user already saw the result, and a missing
    // history row is a small price to pay for availability.
    try {
      await prisma.scanEvent.create({
        data: {
          workspaceId: workspace.id,
          userId,
          code: code.slice(0, 500), // safety cap on huge pastes
          source: 'manual', // The ?code= path is always manual
          // (camera scans also go through this same redirect, so
          // the source attribute gets overwritten below in the
          // client component for the camera path. We use 'manual'
          // here as the safer default.)
          matched: lookup.type === 'none' ? null : lookup.type,
          matchedId: lookup.type === 'none' ? null : (
            lookup.type === 'sub' ? sub!.id :
            lookup.type === 'project' ? project!.id :
            client!.id
          ),
        },
      });
    } catch (err) {
      console.error('[scan] failed to persist ScanEvent:', err);
    }
  }

  // Recent scans for the "Recent scans" panel. Limit to 10 to
  // keep the page tight. We show this even when the user hasn't
  // scanned yet this session, so a fresh user sees an empty list
  // and knows where history will appear once they scan.
  const recentScans = await listRecentScansForWorkspace(workspace.id, 10);

  // Active projects for the create-from-scan form. We only
  // include ACTIVE / ON_HOLD projects (not COMPLETED /
  // CANCELLED) because adding inventory to a finished job is
  // almost always a mistake.
  const inventoryProjects = searchParams.code
    ? await listActiveProjectsForInventory(workspace.id)
    : [];

  // If the local sub/project/client match didn't find anything,
  // try the product catalog. This hits the workspace's cached
  // products first, then falls through to UPCitemdb and Open
  // Food Facts. Slow on a cache miss (network round-trip) but
  // instant on every subsequent scan of the same code.
  let product = null as Awaited<ReturnType<typeof lookupProduct>> | null;
  if (searchParams.code && lookup.type === 'none') {
    product = await lookupProduct(workspace.id, searchParams.code);
  }

  return (
    <div>
      <PageHeader
        title="Scan"
        subtitle="Scan a barcode or QR code to look up equipment, materials, or contacts"
      />

      {searchParams.code ? (
        <div className="mb-6 max-w-2xl mx-auto">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
            {'// Last scan result'}
          </div>
          <div className="bg-paper border-2 border-line p-4">
            <div className="text-[12px] font-mono break-all bg-cream-2 px-3 py-2 mb-3">
              {searchParams.code}
            </div>
            {lookup.type !== 'none' ? (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-success mb-1">
                  ✓ Found in workspace
                </div>
                <a
                  href={lookup.href}
                  className="font-extrabold text-[15px] text-orange-d hover:underline"
                >
                  {lookup.label} →
                </a>
              </div>
            ) : product && product.kind === 'found' ? (
              <ProductCard
                product={product.product}
                workspaceSlug={workspace.slug}
                projects={inventoryProjects}
                scannedCode={searchParams.code}
              />
            ) : (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Not found
                </div>
                <p className="text-[12px] text-ink-70 mb-4">
                  This code isn&apos;t linked to anything in your workspace yet.
                  We also didn&apos;t find it in any online product database.
                  Add it to a project&apos;s inventory as a new material or
                  piece of equipment — you can fill in the details yourself.
                </p>
                <CreateInventoryFromScan
                  workspaceSlug={workspace.slug}
                  scannedCode={searchParams.code}
                  projects={inventoryProjects}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      <ScanPageClient
        workspaceSlug={workspace.slug}
        plan={workspace.plan}
        isMasterAdmin={master}
        recentScans={recentScans.map((s) => ({
          id: s.id,
          code: s.code,
          source: s.source,
          matched: s.matched,
          matchedLabel:
            s.matched === 'project' ? s.projectName :
            s.matched === 'sub' ? s.subName :
            s.matched === 'client' ? s.clientName :
            null,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

/**
 * Card shown when a product was found in the workspace's
 * catalog or in an online product database. Displays the
 * product details (image, name, brand, description) and lets
 * the user create a Material or Equipment on a specific
 * project pre-filled with this product's data.
 *
 * The product is already in the workspace's
 * ProductCatalogItem table (either pre-existing or just-
 * created via the lookup), so the user only has to pick
 * project + kind + cost + qty. The form re-uses the
 * CreateInventoryFromScan component but seeds it with
 * the product's name/description so the user doesn't have
 * to type what we already know.
 */
function ProductCard({
  product,
  workspaceSlug,
  projects,
  scannedCode,
}: {
  product: NonNullable<Awaited<ReturnType<typeof lookupProduct>>> extends infer T
    ? T extends { kind: 'found'; product: infer P }
      ? P
      : never
    : never;
  workspaceSlug: string;
  projects: Array<{ id: string; name: string; code: string | null }>;
  scannedCode: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-success mb-1">
        ✓ Product found
      </div>
      <div className="bg-paper border-2 border-success/40 p-4 mb-4">
        <div className="flex gap-3">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-20 h-20 object-contain bg-white border border-line shrink-0"
            />
          ) : (
            <div className="w-20 h-20 bg-cream-2 border border-line flex items-center justify-center text-2xl shrink-0">
              📦
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-[14px] leading-snug text-ink">
              {product.name}
            </div>
            {product.brand ? (
              <div className="text-[12px] text-ink-70 mt-0.5">
                {product.brand}
                {product.manufacturer && product.manufacturer !== product.brand
                  ? ` · ${product.manufacturer}`
                  : ''}
              </div>
            ) : null}
            {product.category ? (
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1 truncate">
                {product.category}
              </div>
            ) : null}
            {product.description ? (
              <div className="text-[11px] text-ink-70 mt-1 line-clamp-2">
                {product.description}
              </div>
            ) : null}
            <div className="text-[10px] font-mono text-ink-50 mt-2">
              source: {product.source}
              {product.source === 'cache' ? ' (workspace catalog)' : ' (online lookup)'}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-ink-70 mb-3">
        Add this to a project&apos;s inventory:
      </p>
      <CreateInventoryFromScan
        workspaceSlug={workspaceSlug}
        scannedCode={scannedCode}
        projects={projects}
        prefilled={{
          name: product.name,
          description: product.description ?? '',
        }}
      />
    </div>
  );
}
