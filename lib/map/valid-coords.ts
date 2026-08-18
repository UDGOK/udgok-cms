/**
 * Validity check for project coordinates. Returns true if the
 * lat/lng pair is usable on a map.
 *
 * A coordinate is "valid" when:
 *   - Both lat and lng are non-null numbers
 *   - They're inside the actual lat/lng range (-90..90, -180..180)
 *   - They're NOT (0, 0) — the "Null Island" pin in the Gulf of
 *     Guinea, which is what you get when a user submits an empty
 *     form or types 0 in both fields. Real construction sites
 *     are never at (0, 0).
 *
 * Why filter (0, 0) instead of just checking `not null`?
 * Because Prisma's nullable Float? column returns 0 when the
 * caller explicitly stores 0, and the project page's manual-pin
 * form has historically allowed typing 0 in both fields. A
 * `not null` check would happily include (0, 0) and the pin
 * would render in the middle of the Atlantic — invisible to
 * the user who's looking at Oklahoma.
 *
 * If a real project ever needs to be at lat=0 (somewhere on
 * the equator like Quito), this helper should be relaxed.
 * For UDGOK's Oklahoma-area construction projects, (0, 0) is
 * always wrong.
 */
export function hasValidCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Returns a valid [lat, lng] pair, or null if invalid. Useful
 * for the initial-view center calculation where we need a
 * finite number to average.
 */
export function validLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): [number, number] | null {
  if (!hasValidCoords(lat, lng)) return null;
  return [lat as number, lng as number];
}
