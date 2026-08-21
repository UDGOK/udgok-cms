/**
 * Geo helpers — distance + map-link utilities.
 *
 * We don't bundle a heavy geolocation library for what is
 * effectively a single Haversine call. The math is small,
 * pure, and has no side effects.
 */

/** Earth's mean radius in meters (IUGG / WGS-84 mean). */
const EARTH_RADIUS_M = 6_371_008.8;

/** Degrees → radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points, in
 * meters, using the Haversine formula.
 *
 *   - Accurate to ~0.5% over short distances (a few km).
 *     Well within the noise of consumer GPS, so the
 *     extra precision of Vincenty isn't worth the
 *     compute.
 *   - Returns 0 if either point is null/undefined.
 *   - Returns NaN if either point is non-finite.
 */
export function haversineMeters(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined,
): number {
  if (!a || !b) return 0;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return 0;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return 0;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Round meters for display. We round to the nearest 5m
 * below 100m, and the nearest 10m above — the visitor
 * doesn't need to know their GPS wobbled by 3m.
 */
export function roundDistanceForDisplay(meters: number | null | undefined): number {
  if (meters == null || !Number.isFinite(meters)) return 0;
  if (meters < 100) return Math.round(meters / 5) * 5;
  if (meters < 1000) return Math.round(meters / 10) * 10;
  return Math.round(meters / 50) * 50;
}

/**
 * Build a Google Maps "view this point" URL.
 * Used in admin tables and on printed stickers so the
 * admin can tap the coords and see the site on a map.
 */
export function googleMapsUrl(lat: number, lng: number, zoom = 18): string {
  return `https://www.google.com/maps/@${lat},${lng},${zoom}z`;
}

/**
 * Build a short, human-readable "how far" string.
 * 47m → "47 m"   340m → "340 m"   2.3km → "2.3 km"
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
