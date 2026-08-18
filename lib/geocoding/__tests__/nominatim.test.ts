import { describe, it, expect } from 'vitest';
import { buildAddressQuery } from '../index';

describe('buildAddressQuery', () => {
  it('joins address parts with commas, skipping empty', () => {
    expect(
      buildAddressQuery({ address: '123 Main St', city: 'Houston', state: 'TX', zip: '77002' }),
    ).toBe('123 Main St, Houston, TX, 77002');
  });

  it('skips null and empty parts', () => {
    expect(
      buildAddressQuery({ address: '123 Main St', city: null, state: '', zip: '77002' }),
    ).toBe('123 Main St, 77002');
  });

  it('returns empty string when no parts', () => {
    expect(buildAddressQuery({})).toBe('');
  });

  it('trims whitespace', () => {
    expect(
      buildAddressQuery({ address: '  123 Main St  ', city: ' Houston ' }),
    ).toBe('123 Main St, Houston');
  });
});
