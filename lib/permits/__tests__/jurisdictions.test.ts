import { describe, it, expect } from 'vitest';
import { findJurisdiction, buildMapSearchUrl } from '../jurisdictions';

describe('findJurisdiction', () => {
  it('matches Tulsa, OK', () => {
    const j = findJurisdiction('Tulsa', 'OK', '74103');
    expect(j?.slug).toBe('tulsa');
    expect(j?.phone).toBe('(918) 596-9456');
  });

  it('matches Grand Prairie, TX', () => {
    const j = findJurisdiction('Grand Prairie', 'TX', '75050');
    expect(j?.slug).toBe('grand-prairie');
    expect(j?.phone).toBe('(972) 237-8400');
  });

  it('matches by ZIP prefix when city is missing', () => {
    const j = findJurisdiction(null, null, '78704');
    expect(j?.slug).toBe('austin');
  });

  it('is case-insensitive', () => {
    const j = findJurisdiction('TULSA', 'ok', null);
    expect(j?.slug).toBe('tulsa');
  });

  it('handles "OKC" alias', () => {
    const j = findJurisdiction('OKC', 'OK', null);
    expect(j?.slug).toBe('oklahoma-city');
  });

  it('returns null for unknown cities', () => {
    const j = findJurisdiction('Nowhereville', 'XX', null);
    expect(j).toBeNull();
  });

  it('returns null for empty input', () => {
    const j = findJurisdiction(null, null, null);
    expect(j).toBeNull();
  });

  it('matches Fort Worth by "FT WORTH" alias', () => {
    const j = findJurisdiction('FT Worth', 'TX', null);
    expect(j?.slug).toBe('fort-worth');
  });
});

describe('buildMapSearchUrl', () => {
  it('builds a query from a full address', () => {
    const url = buildMapSearchUrl({
      address: '123 Main St',
      city: 'Tulsa',
      state: 'OK',
      zip: '74103',
    });
    expect(url).toContain('123%20Main%20St');
    expect(url).toContain('Tulsa');
    expect(url).toContain('OK');
  });

  it('returns null when no address parts', () => {
    const url = buildMapSearchUrl({});
    expect(url).toBeNull();
  });
});
