/**
 * Nominatim (OpenStreetMap) geocoder.
 *
 * No API key, free, but the public endpoint has a 1-req/sec rate limit
 * and requires a User-Agent per the OSM usage policy:
 *   https://operations.osmfoundation.org/policies/nominatim/
 *
 * We identify as "udgok-cms/0.1.0" with a contact URL. The agent is
 * configurable via UDGOK_CMS_NOMINATIM_USER_AGENT (and its alias
 * NOMINATIM_USER_AGENT, wired in next.config.mjs).
 *
 * For batch backfills we serialize requests with a 1.1s sleep between
 * calls. For single calls (the form-driven auto-geocode), we just rely
 * on the 1.5s request timeout.
 *
 * If we ever outgrow the free tier, swap this for Mapbox / Google /
 * Photon behind the same `geocode()` interface in lib/geocoding/index.ts.
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: 'nominatim';
  /** Raw address-type info from Nominatim, useful for filtering. */
  category?: string;
  type?: string;
  /** Bounding box of the matched feature, [south, north, west, east]. */
  bbox?: [number, number, number, number];
}

export interface GeocodeError {
  error: string;
  source: 'nominatim';
}

const BASE_URL = process.env.UDGOK_CMS_NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT =
  process.env.UDGOK_CMS_NOMINATIM_USER_AGENT ||
  'udgok-cms/0.1.0 (https://cms.udgok.com; support@udgok.com)';

const REQUEST_TIMEOUT_MS = 4500;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  category?: string;
  type?: string;
  boundingbox?: [string, string, string, string];
  importance?: number;
}

/**
 * Geocode a free-form address string.
 * Returns null if the address can't be resolved (or the service fails).
 * Never throws — caller treats null as "couldn't geocode, try again later".
 */
export async function nominatimGeocode(
  query: string,
  opts: { countryCode?: string } = {},
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });
  if (opts.countryCode) params.set('countrycodes', opts.countryCode.toLowerCase());

  const url = `${BASE_URL}/search?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        // OSM requires a real User-Agent. Many corporate proxies strip
        // these; we also send a Referer as a fallback identifier.
        'User-Agent': USER_AGENT,
        Referer: 'https://cms.udgok.com',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      // 429 = rate limited. We log nothing for these — the backfill
      // script handles its own pacing. The caller treats null as
      // "couldn't geocode, try again".
      return null;
    }
    const data = (await res.json()) as NominatimResult[] | { error: string };
    if (!Array.isArray(data) || data.length === 0) return null;
    const top = data[0];
    const lat = Number(top.lat);
    const lon = Number(top.lon);
    if (!isFinite(lat) || !isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    const result: GeocodeResult = {
      latitude: lat,
      longitude: lon,
      formattedAddress: top.display_name,
      source: 'nominatim',
      category: top.category,
      type: top.type,
    };
    if (top.boundingbox) {
      const [south, north, west, east] = top.boundingbox.map(Number);
      if (isFinite(south) && isFinite(north) && isFinite(west) && isFinite(east)) {
        result.bbox = [south, north, west, east];
      }
    }
    return result;
  } catch {
    // Timeout, network error, malformed JSON — all treated as null.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sleep helper for batch backfill pacing (1 req/sec for OSM ToS).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
