import { describe, it, expect } from 'vitest';
import { formatName } from '../BarcodeScanner';

/**
 * Tests for the formatName helper — translates html5-qrcode's
 * internal format slugs into the human-readable labels the
 * scanner shows in the live "✓ Scanned" badge and the result
 * card.
 *
 * These are pure functions, so a Node test is fine.
 */

describe('formatName', () => {
  it('translates qr_code to "QR code"', () => {
    expect(formatName('qr_code')).toBe('QR code');
  });

  it('translates common 1D barcode slugs to their standard labels', () => {
    expect(formatName('ean_13')).toBe('EAN-13');
    expect(formatName('upc_a')).toBe('UPC-A');
    expect(formatName('code_128')).toBe('CODE-128');
  });

  it('translates 2D non-QR slugs', () => {
    expect(formatName('aztec')).toBe('Aztec');
    expect(formatName('data_matrix')).toBe('DataMatrix');
    expect(formatName('pdf417')).toBe('PDF417');
  });

  it('handles null / undefined / empty as "code"', () => {
    // Defensive: the scanner passes a slug from the
    // library which is normally always present, but if
    // a future version returns nothing we shouldn't
    // crash — show a neutral label instead.
    expect(formatName(null)).toBe('code');
    expect(formatName(undefined)).toBe('code');
    expect(formatName('')).toBe('code');
  });

  it('title-cases unknown slugs as a graceful fallback', () => {
    // If the library adds a new format we haven't
    // listed, we still want to show something readable
    // — "Custom 39" instead of "custom_39".
    expect(formatName('custom_39')).toBe('Custom 39');
    expect(formatName('new_format')).toBe('New Format');
  });
});
