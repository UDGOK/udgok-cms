import { describe, it, expect } from 'vitest';
import { hasValidCoords, validLatLng } from '../valid-coords';

/**
 * Regression test for the "project not on the map" bug.
 *
 * Before this helper, the workspace map's Prisma query was
 *   where: { latitude: { not: null }, longitude: { not: null } }
 * which happily included projects with lat=0, lng=0. Those
 * pins render at "Null Island" in the Gulf of Guinea — not
 * useful to a UDGOK user looking at Oklahoma job sites. The
 * fix is to exclude (0, 0) at both the query layer and the
 * rendering layer.
 */
describe('hasValidCoords', () => {
  it('accepts Tulsa (the typical UDGOK project location)', () => {
    expect(hasValidCoords(36.06, -95.87)).toBe(true);
  });

  it('rejects (0, 0) — Null Island in the Gulf of Guinea', () => {
    // This is the actual bug: a user manually typed 0 in both
    // fields and the system stored lat=0, lng=0. The old
    // `not: null` check included this row in the map.
    expect(hasValidCoords(0, 0)).toBe(false);
  });

  it('rejects null / undefined in either field', () => {
    expect(hasValidCoords(null, -95.87)).toBe(false);
    expect(hasValidCoords(36.06, null)).toBe(false);
    expect(hasValidCoords(undefined, undefined)).toBe(false);
    expect(hasValidCoords(null, null)).toBe(false);
  });

  it('accepts (0, -95.87) — equator at a real longitude', () => {
    // We only reject the specific (0, 0) case (Null Island),
    // not single-zero values. A project legitimately on the
    // equator (Quito, for example) would have lat=0 with a
    // real lng. Forcing the user to clear that would be wrong.
    expect(hasValidCoords(0, -95.87)).toBe(true);
    expect(hasValidCoords(36.06, 0)).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    expect(hasValidCoords(91, 0)).toBe(false);
    expect(hasValidCoords(-91, 0)).toBe(false);
    expect(hasValidCoords(0, 181)).toBe(false);
    expect(hasValidCoords(0, -181)).toBe(false);
  });

  it('rejects non-finite numbers (NaN, Infinity)', () => {
    expect(hasValidCoords(NaN, 0)).toBe(false);
    expect(hasValidCoords(0, NaN)).toBe(false);
    expect(hasValidCoords(Infinity, 0)).toBe(false);
  });

  it('accepts the boundary values', () => {
    expect(hasValidCoords(90, 180)).toBe(true);
    expect(hasValidCoords(-90, -180)).toBe(true);
  });
});

describe('validLatLng', () => {
  it('returns [lat, lng] for valid coordinates', () => {
    expect(validLatLng(36.06, -95.87)).toEqual([36.06, -95.87]);
  });

  it('returns null for (0, 0)', () => {
    expect(validLatLng(0, 0)).toBeNull();
  });

  it('returns null for null inputs', () => {
    expect(validLatLng(null, null)).toBeNull();
    expect(validLatLng(null, -95.87)).toBeNull();
  });
});
