/**
 * Geocoding interface. Right now only Nominatim is implemented; this
 * module exists so we can swap to Mapbox / Google / Photon later
 * without touching call sites.
 *
 * Convention:
 *   - `geocode(addr)` returns a result, or null if the address
 *     couldn't be resolved. Never throws.
 *   - `geocodeOrThrow` is the version that surfaces errors — used by
 *     the backfill script where we want to know which addresses
 *     actually failed (vs which the service just didn't know about).
 */

import { nominatimGeocode, type GeocodeResult } from './nominatim';

export type { GeocodeResult };

/**
 * Build a single query string from the address parts. Empty parts are
 * skipped so we don't end up with "123 Main St, , TX, 75001" (extra
 * commas make Nominatim's parser less reliable).
 */
export function buildAddressQuery(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  return [parts.address, parts.city, parts.state, parts.zip]
    .filter((p): p is string => !!p && String(p).trim().length > 0)
    .map((p) => String(p).trim())
    .join(', ');
}

/**
 * Country code inferred from a US state abbreviation. Right now we
 * only ship to the US, so we narrow Nominatim's search to US results
 * for cleaner matches. If/when we go international, drop this and
 * pass countryCode through from the workspace.
 */
function inferCountryCode(state: string | null | undefined): string {
  if (!state) return 'us';
  return 'us';
}

/**
 * Geocode a project's address. Returns null if any required field is
 * missing, if the service is unavailable, or if the address can't
 * be resolved. Never throws.
 */
export async function geocodeProjectAddress(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): Promise<GeocodeResult | null> {
  const query = buildAddressQuery(parts);
  if (!query) return null;
  return nominatimGeocode(query, { countryCode: inferCountryCode(parts.state) });
}
