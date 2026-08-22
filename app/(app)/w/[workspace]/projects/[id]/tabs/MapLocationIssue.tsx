/**
 * MapLocationIssue — fallback shown on the Map tab when the
 * project has no valid coordinates. Two flavors:
 *
 *   - hasAnyCoords: at least one of lat/lng is set, but
 *     the value is the (0, 0) sentinel or otherwise invalid.
 *     Tells the user to clear the pin and let the geocoder
 *     re-run.
 *   - no coords: nothing has been set. Tells the user to
 *     add an address or drop a manual pin.
 *
 * Both flavors link to the project details anchor (#details)
 * where the Edit button lives.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor.
 */

export function MapLocationIssue({
  workspaceSlug,
  projectId,
  hasAnyCoords,
}: {
  workspaceSlug: string;
  projectId: string;
  hasAnyCoords: boolean;
}) {
  return (
    <div className="border border-warning/40 bg-warning/10 p-6 md:p-10 text-center">
      <div className="text-4xl mb-3">{hasAnyCoords ? '⚠️' : '📍'}</div>
      <h3 className="text-lg font-black mb-2">
        {hasAnyCoords ? 'Pin is missing or invalid' : 'No site pin yet'}
      </h3>
      <p className="text-sm text-ink-70 max-w-md mx-auto mb-5">
        {hasAnyCoords
          ? 'The latitude/longitude on this project is empty or (0, 0) — usually a half-filled manual pin. Clear the pin and the geocoder will re-run from the project address, or set the coordinates manually.'
          : 'Add a project address and we\u2019ll auto-geocode it. Or click \u201cEdit details\u201d above to drop a manual pin on the map.'}
      </p>
      <a
        href={`/w/${workspaceSlug}/projects/${projectId}#details`}
        className="inline-block px-4 py-2 bg-orange text-paper text-xs font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d transition-colors"
      >
        Open project details
      </a>
    </div>
  );
}
