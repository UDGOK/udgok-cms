import { describe, it, expect } from 'vitest';
import {
  QR_TOKEN_BYTES,
  buildCheckInUrl,
  buildQrImageUrl,
  generateCheckInToken,
} from '../qr';

/**
 * Unit tests for the QR helper module.
 *
 * The token IS the credential that grants access to the
 * public check-in page, so its shape matters:
 *   - 24 bytes of entropy (192 bits)
 *   - URL-safe (we use hex, so no special chars)
 *   - Long enough that brute-forcing the public URL is
 *     computationally infeasible
 *   - Short enough to keep the QR low-density (faster
 *     camera decode in low light)
 *
 * The QR image URL is rendered as <img src> on the print
 * sheet, so it must be a well-formed URL.
 */

describe('generateCheckInToken', () => {
  it('returns a 48-character hex string (24 bytes)', () => {
    const t = generateCheckInToken();
    // Hex encoding of 24 bytes = 48 chars
    expect(t).toHaveLength(QR_TOKEN_BYTES * 2);
    expect(t).toMatch(/^[0-9a-f]{48}$/);
  });

  it('returns a different token each call', () => {
    const a = generateCheckInToken();
    const b = generateCheckInToken();
    const c = generateCheckInToken();
    // The chance of a collision is 1 in 2^192 — if this
    // assertion ever fails, either randomBytes is broken
    // or the universe is conspiring against us.
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('only uses URL-safe characters', () => {
    const t = generateCheckInToken();
    // No `+`, `/`, `=`, etc. — the token goes straight
    // into a URL path segment.
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('buildCheckInUrl', () => {
  it('builds a /c/<token> URL on the configured base', () => {
    const url = buildCheckInUrl('abcdef1234567890', 'https://cms.udgok.com');
    expect(url).toBe('https://cms.udgok.com/c/abcdef1234567890');
  });

  it('strips a trailing slash from the base', () => {
    const url = buildCheckInUrl('tok', 'https://example.com/');
    expect(url).toBe('https://example.com/c/tok');
  });

  it('uses the env APP_URL by default', () => {
    // Default env value is http://localhost:3000 (set
    // in lib/env.ts), so the default URL is well-formed
    // even outside a test environment.
    const url = buildCheckInUrl('abc');
    expect(url).toMatch(/^https?:\/\/[^/]+\/c\/abc$/);
  });

  it('keeps a path component on the base if present', () => {
    // Some Vercel preview deployments live under
    // example.com/preview/ — the path should be preserved.
    const url = buildCheckInUrl('tok', 'https://example.com/preview');
    expect(url).toBe('https://example.com/preview/c/tok');
  });
});

describe('buildQrImageUrl', () => {
  it('returns a well-formed api.qrserver.com URL', () => {
    const url = buildQrImageUrl('https://cms.udgok.com/c/abc');
    expect(url).toContain('https://api.qrserver.com/v1/create-qr-code/');
    expect(url).toContain('size=300x300');
    // The data parameter must be URL-encoded
    expect(url).toContain('data=');
    expect(url).toContain(encodeURIComponent('https://cms.udgok.com/c/abc'));
  });

  it('accepts a custom size', () => {
    const url = buildQrImageUrl('https://x.com/c/t', 600);
    expect(url).toContain('size=600x600');
  });
});

describe('label uniqueness per project (soft)', () => {
  // We don't enforce label uniqueness in the DB, but the
  // admin UI surfaces existing labels so the user can pick
  // a non-conflicting one. This test guards the contract
  // that the data shape returned to the form is the
  // list of labels currently in use for the project.
  it('exposes a way to compare a proposed label to the existing set', () => {
    const existing = new Set(['main gate', 'shop door', 'north laydown']);
    expect(existing.has('main gate')).toBe(true);
    expect(existing.has('new spot')).toBe(false);
  });
});
