import dynamic from 'next/dynamic';
import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';

// MapLibre is browser-only; the client wrapper uses next/dynamic so
// the server doesn't try to import the CSS or call `new Map()` at
// build/render time. ssr:false is required because maplibre-gl
// touches `window` at import time.
const WorkspaceMap = dynamic(
  () => import('./WorkspaceMapClient').then((m) => m.WorkspaceMapClient),
  { ssr: false, loading: () => <MapSkeleton /> },
);

export default async function WorkspaceMapPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  // Pull every project that has usable lat/lng. "Usable" means:
  //   - both fields are non-null
  //   - the pair is not (0, 0) — that's the "Null Island" pin
  //     in the Gulf of Guinea, which happens when a user types
  //     0 in both lat and lng fields or submits an empty form.
  //     A construction project in Oklahoma is never legitimately
  //     at lat 0, lng 0. (See lib/map/valid-coords.ts for the
  //     full validity rules.)
  //
  // We deliberately don't try to geocode missing/invalid ones
  // here — that's a slow blocking operation. The
  // `ProjectLocationBadge` on each project already shows the
  // re-geocode button. The map just renders what's there.
  const projects = await prisma.project.findMany({
    where: {
      workspaceId: workspace.id,
      // Reject Null Island (0, 0) — see lib/map/valid-coords.ts.
      // Prisma's where filter syntax only allows one `not` per
      // field, so we use `notIn` with the 0 sentinel.
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { OR: [{ latitude: { not: 0 } }, { longitude: { not: 0 } }] },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      contractValue: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Serialize Decimal → string for the client component.
  const mapProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    status: p.status,
    city: p.city,
    state: p.state,
    latitude: p.latitude as number,
    longitude: p.longitude as number,
    contractValue: p.contractValue ? p.contractValue.toString() : null,
  }));

  // Count projects that have NO usable coords (null OR 0,0) so we
  // can show a small banner pointing the user at the fix. A project
  // with address but bad coords is almost always an "I typed 0
  // in both fields" or a "the geocoder hasn't run yet" — both
  // easily fixed from the project page.
  const unpinnedCount = await prisma.project.count({
    where: {
      workspaceId: workspace.id,
      OR: [
        { latitude: null },
        { longitude: null },
        { latitude: 0 },
        { longitude: 0 },
      ],
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <MobilePageHeader
        title="Site map"
        subtitle={`${mapProjects.length} project${mapProjects.length === 1 ? '' : 's'} pinned`}
        backHref={`/w/${workspace.slug}/projects`}
      />
      <div className="hidden md:flex text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          ◉
        </span>
        Site map
      </div>
      <h1 className="hidden md:block text-display-lg mb-2">
        Every <span className="font-serif italic text-orange-d">job site,</span> one view.
      </h1>
      <p className="text-sm md:text-base text-ink-70 max-w-xl mb-5 md:mb-7">
        Projects with a geocoded address appear as pins. Tap a pin to jump to
        the project. Use the project page to set or correct a pin.
      </p>

      {unpinnedCount > 0 ? (
        <UnpinnedBanner count={unpinnedCount} workspaceSlug={workspace.slug} />
      ) : null}

      <div className="border border-line bg-paper">
        {mapProjects.length === 0 ? (
          <EmptyState workspaceSlug={workspace.slug} />
        ) : (
          <div style={{ height: '70vh', minHeight: 480 }}>
            <WorkspaceMap projects={mapProjects} workspaceSlug={workspace.slug} />
          </div>
        )}
      </div>

      <Legend />
    </div>
  );
}

function UnpinnedBanner({
  count,
  workspaceSlug,
}: {
  count: number;
  workspaceSlug: string;
}) {
  return (
    <div className="mb-4 border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-3">
      <span className="text-xl leading-none mt-0.5" aria-hidden="true">⚠️</span>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-ink">
          {count} project{count === 1 ? '' : 's'} not pinned on the map
        </p>
        <p className="text-ink-70 mt-0.5">
          These projects have a missing or invalid location (often 0,0 entered
          in the lat/lng fields). Open each project and use the address
          auto-geocoder or a manual pin to put it on the map.
        </p>
      </div>
      <a
        href={`/w/${workspaceSlug}/projects`}
        className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.1em] px-3 py-1.5 border border-line bg-paper hover:bg-paper-2"
      >
        See projects →
      </a>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="h-full w-full min-h-[480px] flex items-center justify-center bg-paper-2">
      <div className="text-ink-50 font-mono text-xs uppercase tracking-[0.2em]">
        Loading map…
      </div>
    </div>
  );
}

function EmptyState({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="p-8 md:p-12 text-center">
      <div className="text-4xl mb-3">🗺️</div>
      <h3 className="text-lg font-black mb-2">No pinned projects yet</h3>
      <p className="text-sm text-ink-70 max-w-md mx-auto mb-5">
        Add a project address and we&apos;ll automatically pin it on the map.
        Or manually drop a pin from the project page.
      </p>
      <Link
        href={`/w/${workspaceSlug}/projects/new`}
        className="inline-block px-4 py-2 bg-orange text-paper text-xs font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d transition-colors"
      >
        + Create project
      </Link>
    </div>
  );
}

function Legend() {
  const items = [
    { color: '#ff5a1f', label: 'Active' },
    { color: '#a8a29e', label: 'On hold' },
    { color: '#16a34a', label: 'Completed' },
    { color: '#57534e', label: 'Cancelled' },
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full border-2 border-paper"
            style={{ background: i.color, boxShadow: `0 0 0 1px ${i.color}` }}
          />
          {i.label}
        </div>
      ))}
    </div>
  );
}
