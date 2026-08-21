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

  // ---- Regression: Bixby, OK was being misattributed to Broken Arrow
  // because they share the 740 zip prefix. After adding the Bixby
  // entry, city+state must win over zip.
  it('matches Bixby, OK by city+state (not Broken Arrow by zip)', () => {
    const j = findJurisdiction('Bixby', 'OK', '74008');
    expect(j?.slug).toBe('bixby');
    expect(j?.name).toBe('City of Bixby');
    expect(j?.phone).toBe('(918) 366-4430');
  });

  it('exposes the MyGov portal URL for Bixby', () => {
    const j = findJurisdiction('Bixby', 'OK', '74008');
    expect(j?.portalUrl).toMatch(/^https:\/\/web\.mygov\.us\//);
    expect(j?.portalUrl).toContain('city_id=182');
    expect(j?.portalLabel).toContain('MyGov');
  });

  it('still matches Broken Arrow by city name', () => {
    const j = findJurisdiction('Broken Arrow', 'OK', '74012');
    expect(j?.slug).toBe('broken-arrow');
  });

  it('Broken Arrow "BA" alias still works', () => {
    const j = findJurisdiction('BA', 'OK', null);
    expect(j?.slug).toBe('broken-arrow');
  });

  it('matches Jenks, Owasso, Sand Springs, Sapulpa, Glenpool, Catoosa, Coweta', () => {
    expect(findJurisdiction('Jenks', 'OK', '74037')?.slug).toBe('jenks');
    expect(findJurisdiction('Owasso', 'OK', '74055')?.slug).toBe('owasso');
    expect(findJurisdiction('Sand Springs', 'OK', '74063')?.slug).toBe('sand-springs');
    expect(findJurisdiction('Sapulpa', 'OK', '74066')?.slug).toBe('sapulpa');
    expect(findJurisdiction('Glenpool', 'OK', '74033')?.slug).toBe('glenpool');
    expect(findJurisdiction('Catoosa', 'OK', '74015')?.slug).toBe('catoosa');
    expect(findJurisdiction('Coweta', 'OK', '74429')?.slug).toBe('coweta');
  });

  it('falls back to city-name-only match when state is missing', () => {
    // No state — step 1 (city+state) is skipped. Step 2 (zip) is
    // skipped because zip is null. Step 3 (city-only) catches it.
    const j = findJurisdiction('Bixby', null, null);
    expect(j?.slug).toBe('bixby');
  });

  it('does NOT misattribute Bixby to Broken Arrow via zip alone', () => {
    // Without city, a 740 zip used to hit Broken Arrow. After
    // removing Broken Arrow's zipPrefixes (and adding the
    // 740-prefix cities with their own entries), the only
    // matches are the actual 740 cities. The first one in
    // the registry for that prefix wins — that's Bixby.
    const j = findJurisdiction(null, 'OK', '74008');
    expect(j?.slug).not.toBe('broken-arrow');
    expect(j?.slug).toBe('bixby');
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
