// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * CSV escaping rules. The format follows RFC 4180:
 *   - fields containing " , \r \n are quoted
 *   - quotes inside the field are doubled
 *   - rows are CRLF-terminated (Excel-friendly)
 */

import { csvEscape, csvRow, toCsv } from '../csv';

describe('csvEscape', () => {
  it('passes through plain values', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(0)).toBe('0');
  });

  it('emits empty string for null / undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes fields containing a comma', () => {
    expect(csvEscape('Smith, Bob')).toBe('"Smith, Bob"');
  });

  it('quotes fields containing a quote, doubling the quote', () => {
    expect(csvEscape('She said "hi"')).toBe('"She said ""hi"""');
  });

  it('quotes fields containing CR or LF', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('a\rb')).toBe('"a\rb"');
  });
});

describe('csvRow', () => {
  it('joins fields with commas', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('escapes each field independently', () => {
    expect(csvRow(['plain', 'has, comma', null])).toBe('plain,"has, comma",');
  });
});

describe('toCsv', () => {
  it('joins rows with CRLF', () => {
    const csv = toCsv([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(csv).toBe('a,b\r\nc,d');
  });

  it('escapes fields with quotes / commas / newlines', () => {
    const csv = toCsv([
      ['name', 'note'],
      ['"quoted"', 'has, comma'],
    ]);
    expect(csv).toBe('name,note\r\n"""quoted""","has, comma"');
  });
});
