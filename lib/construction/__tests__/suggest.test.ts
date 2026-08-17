import { describe, it, expect } from 'vitest';
import { suggestCSI } from '../suggest';
import { CSI_MASTERFORMAT, DEFAULT_SOV_TEMPLATE } from '../csi-masterformat';

describe('suggestCSI — fuzzy match CSI codes from free text', () => {
  it('returns nothing for empty query', () => {
    expect(suggestCSI('')).toEqual([]);
    expect(suggestCSI('   ')).toEqual([]);
  });

  it('matches "plumbing" → 22 Plumbing', () => {
    const result = suggestCSI('plumbing');
    expect(result.length).toBeGreaterThan(0);
    const top = result[0];
    expect(top.isTopMatch).toBe(true);
    expect(top.division.number).toBe('22');
    expect(top.division.name).toBe('Plumbing');
  });

  it('matches "hvac" → 23 HVAC (case insensitive)', () => {
    const result = suggestCSI('HVAC');
    expect(result[0].division.number).toBe('23');
  });

  it('matches "drywall" → 09 Finishes', () => {
    const result = suggestCSI('drywall');
    expect(result[0].division.number).toBe('09');
    expect(result[0].division.name).toBe('Finishes');
  });

  it('matches "framing" → 06 Wood, Plastics & Composites', () => {
    const result = suggestCSI('framing');
    expect(result[0].division.number).toBe('06');
  });

  it('matches "steel" → 05 Metals (via "structural steel" sub-section)', () => {
    // The word "steel" alone doesn't appear in "Metals" — but it does
    // appear in the description ("Structural steel, metal joists..."). This
    // test is loose: we just want at least one Metals-related match in the
    // top 3.
    const result = suggestCSI('steel');
    const metalsIdx = result.findIndex((s) => s.division.number === '05');
    expect(metalsIdx).toBeGreaterThanOrEqual(0);
    expect(metalsIdx).toBeLessThanOrEqual(3);
  });

  it('matches "electrical" → 26 Electrical', () => {
    const result = suggestCSI('electrical');
    expect(result[0].division.number).toBe('26');
  });

  it('matches a CSI code directly when user types "22"', () => {
    const result = suggestCSI('22');
    expect(result[0].division.number).toBe('22');
    expect(result[0].isTopMatch).toBe(true);
  });

  it('matches a full CSI code like "09 29 00"', () => {
    const result = suggestCSI('09 29 00');
    expect(result[0].division.number).toBe('09');
  });

  it('returns nothing for nonsense', () => {
    expect(suggestCSI('xyzzy frobnicate')).toEqual([]);
  });

  it('respects the limit parameter', () => {
    const result = suggestCSI('the', 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('ignores stop words like "rough" and "work"', () => {
    const result = suggestCSI('rough work');
    // "rough" and "work" are stop words — should match less specifically
    expect(result.length).toBeLessThan(CSI_MASTERFORMAT.length);
  });
});

describe('CSI_MASTERFORMAT — library integrity', () => {
  it('has unique numbers', () => {
    const numbers = CSI_MASTERFORMAT.map((d) => d.number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });

  it('has 18+ divisions (covers the most common construction trades)', () => {
    expect(CSI_MASTERFORMAT.length).toBeGreaterThanOrEqual(18);
  });

  it('every division has non-empty name and description', () => {
    for (const d of CSI_MASTERFORMAT) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it('covers the essential 5 trades (concrete, plumbing, HVAC, electrical, finishes)', () => {
    const numbers = new Set(CSI_MASTERFORMAT.map((d) => d.number));
    for (const required of ['03', '22', '23', '26', '09']) {
      expect(numbers.has(required)).toBe(true);
    }
  });
});

describe('DEFAULT_SOV_TEMPLATE — sanity', () => {
  it('has at least 10 lines', () => {
    expect(DEFAULT_SOV_TEMPLATE.length).toBeGreaterThanOrEqual(10);
  });

  it('every line has a non-empty code and trade', () => {
    for (const l of DEFAULT_SOV_TEMPLATE) {
      expect(l.code.length).toBeGreaterThan(0);
      expect(l.trade.length).toBeGreaterThan(0);
      expect(l.pctOfBudget).toBeGreaterThan(0);
    }
  });

  it('total percentage is around 100% (within ±20% to allow for retained margin)', () => {
    const total = DEFAULT_SOV_TEMPLATE.reduce((acc, l) => acc + l.pctOfBudget, 0);
    expect(total).toBeGreaterThanOrEqual(80);
    expect(total).toBeLessThanOrEqual(120);
  });

  it('every line uses a code that is a valid CSI division prefix', () => {
    const knownDivisions = new Set(CSI_MASTERFORMAT.map((d) => d.number));
    for (const l of DEFAULT_SOV_TEMPLATE) {
      const prefix = l.code.split('-')[0];
      // Allow codes from known divisions OR sub-sections (e.g. "03-3000" is a 03 sub-section)
      // We just verify the prefix is 2 digits and matches a known division number.
      expect(knownDivisions.has(prefix)).toBe(true);
    }
  });
});
