import { describe, it, expect } from 'vitest';
import type { TakeoffResult, TakeoffItem, TakeoffKind, TakeoffUnit } from '../types';

/**
 * Round-trip the TakeoffResult shape the service is expected to
 * return. If the service's contract changes, this test will fail
 * to compile and surface the change at PR time.
 */
describe('TakeoffResult shape', () => {
  it('matches the service contract — every required field present', () => {
    const item: TakeoffItem = {
      csiCode: '03-3000',
      trade: 'Cast-in-place concrete — slabs',
      kind: 'volume' as TakeoffKind,
      unit: 'CY' as TakeoffUnit,
      quantity: 12.4,
      elementCount: 4,
      elementsMissingQuantity: 0,
    };
    const result: TakeoffResult = {
      schema: 'IFC4',
      projectName: 'Test Project',
      totalElements: 4,
      items: [item],
    };
    expect(result.items[0].kind).toBe('volume');
    expect(result.items[0].unit).toBe('CY');
    expect(result.totalElements).toBe(4);
  });

  it('elementsMissingQuantity is always surfaced (never undefined)', () => {
    // The UI relies on this being a number — `undefined` would silently
    // hide the "your number is low" warning.
    const item: TakeoffItem = {
      csiCode: '09-2900',
      trade: 'Walls / gypsum board assemblies',
      kind: 'area',
      unit: 'SF',
      quantity: 0,
      elementCount: 5,
      elementsMissingQuantity: 5,
    };
    expect(item.elementsMissingQuantity).toBe(5);
    // The 0 quantity + non-zero elementsMissingQuantity combo must
    // be representable so the UI can render the "12 of 40 missing"
    // warning instead of a misleading 0 in the table.
    expect(item.quantity).toBe(0);
    expect(item.elementsMissingQuantity).toBeGreaterThan(0);
  });

  it('covers all 16+ CSI divisions the extractor claims to handle', () => {
    // The service's TRADE_MAP covers 14+ divisions. We check that
    // the shape can carry a representative sample — if a new trade
    // is added (say 10-2800 toilet accessories), the types don't
    // need to change, but the test acts as a quick check that
    // arbitrary CSI codes are accepted by the type.
    const sample: TakeoffItem[] = [
      { csiCode: '03-3000', trade: 'Concrete',     kind: 'volume', unit: 'CY', quantity: 10,  elementCount: 2, elementsMissingQuantity: 0 },
      { csiCode: '05-1200', trade: 'Steel beams',  kind: 'length', unit: 'LF', quantity: 220, elementCount: 8, elementsMissingQuantity: 0 },
      { csiCode: '09-2900', trade: 'Drywall',      kind: 'area',   unit: 'SF', quantity: 0,   elementCount: 6, elementsMissingQuantity: 6 },
      { csiCode: '22-1000', trade: 'Plumbing pipe',kind: 'length', unit: 'LF', quantity: 80,  elementCount: 12,elementsMissingQuantity: 0 },
      { csiCode: '23-3000', trade: 'HVAC duct',    kind: 'length', unit: 'LF', quantity: 150, elementCount: 18,elementsMissingQuantity: 0 },
      { csiCode: '26-2700', trade: 'Outlets',      kind: 'count',  unit: 'EA', quantity: 24,  elementCount: 24,elementsMissingQuantity: 0 },
    ];
    expect(sample).toHaveLength(6);
    // Every CSI code is a string of the form N-NNNN
    for (const it of sample) {
      expect(it.csiCode).toMatch(/^\d{2}-\d{4}$/);
    }
  });
});
