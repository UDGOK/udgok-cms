/**
 * Geo / Haversine helper tests.
 *
 * These are the pure functions used to verify a
 * check-in GPS against the bound location of a QR
 * code. The math is small but easy to get wrong
 * (degrees vs radians, mean radius vs WGS-84), so
 * we have a few well-known reference points.
 */

import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  roundDistanceForDisplay,
  formatDistance,
  googleMapsUrl,
} from '../distance';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 36.154, lng: -95.9928 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it('returns 0 when either side is null', () => {
    expect(haversineMeters(null, { lat: 1, lng: 1 })).toBe(0);
    expect(haversineMeters({ lat: 1, lng: 1 }, null)).toBe(0);
    expect(haversineMeters(undefined, undefined)).toBe(0);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(
      haversineMeters(
        { lat: NaN, lng: 0 },
        { lat: 0, lng: 0 },
      ),
    ).toBe(0);
  });

  it('matches a known reference — JFK to LAX (~3,944 km)', () => {
    // JFK: 40.6413, -73.7781
    // LAX: 33.9416, -118.4085
    // Great-circle distance: ~3,973 km
    const d = haversineMeters(
      { lat: 40.6413, lng: -73.7781 },
      { lat: 33.9416, lng: -118.4085 },
    );
    // Allow 1% tolerance for the simple Haversine
    expect(d).toBeGreaterThan(3_900_000);
    expect(d).toBeLessThan(4_050_000);
  });

  it('matches a short-distance reference — 1 degree of latitude ≈ 111 km', () => {
    const d = haversineMeters(
      { lat: 36.0, lng: -95.0 },
      { lat: 37.0, lng: -95.0 },
    );
    // 1 degree of latitude is ~111.2 km
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('is symmetric (distance from A to B equals B to A)', () => {
    const a = { lat: 36.154, lng: -95.9928 };
    const b = { lat: 36.155, lng: -95.9929 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 5);
  });
});

describe('roundDistanceForDisplay', () => {
  it('rounds to nearest 5m below 100m', () => {
    expect(roundDistanceForDisplay(0)).toBe(0);
    expect(roundDistanceForDisplay(47)).toBe(45);
    expect(roundDistanceForDisplay(50)).toBe(50);
    expect(roundDistanceForDisplay(99)).toBe(100);
  });
  it('rounds to nearest 10m between 100m and 1km', () => {
    expect(roundDistanceForDisplay(147)).toBe(150);
    expect(roundDistanceForDisplay(340)).toBe(340);
  });
  it('rounds to nearest 50m above 1km', () => {
    expect(roundDistanceForDisplay(2340)).toBe(2350);
  });
});

describe('formatDistance', () => {
  it('formats meters under 1km as integer m', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(47)).toBe('47 m');
    expect(formatDistance(340)).toBe('340 m');
    expect(formatDistance(999)).toBe('999 m');
  });
  it('formats meters above 1km with one decimal in km', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(2300)).toBe('2.3 km');
  });
  it('returns em-dash for null/NaN', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(undefined)).toBe('—');
    expect(formatDistance(NaN)).toBe('—');
  });
});

describe('googleMapsUrl', () => {
  it('builds a standard maps URL at the given zoom', () => {
    expect(googleMapsUrl(36.154, -95.9928)).toBe(
      'https://www.google.com/maps/@36.154,-95.9928,18z',
    );
  });
  it('respects a custom zoom', () => {
    expect(googleMapsUrl(36.154, -95.9928, 14)).toBe(
      'https://www.google.com/maps/@36.154,-95.9928,14z',
    );
  });
});
