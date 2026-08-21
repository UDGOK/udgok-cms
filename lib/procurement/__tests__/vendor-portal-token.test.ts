/**
 * Vendor portal token — generator + hash.
 *
 * 32 random bytes → base64url, hashed via SHA-256 for the
 * DB. Plaintext never persisted. Token format is consistent
 * with the RFQ token helper.
 */

import { describe, it, expect } from 'vitest';
import { generateVendorPortalToken, sha256Token } from '../vendor-portal-token';

describe('generateVendorPortalToken', () => {
  it('returns a plaintext + hash pair', () => {
    const t = generateVendorPortalToken();
    expect(t.plaintext).toBeTruthy();
    expect(t.hash).toBeTruthy();
    expect(t.plaintext).not.toEqual(t.hash);
  });

  it('plaintext is 43 base64url chars (32 bytes)', () => {
    const t = generateVendorPortalToken();
    expect(t.plaintext.length).toBe(43);
    expect(t.plaintext).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hash is 64 hex chars (SHA-256)', () => {
    const t = generateVendorPortalToken();
    expect(t.hash.length).toBe(64);
    expect(t.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash matches sha256(plaintext)', () => {
    const t = generateVendorPortalToken();
    expect(sha256Token(t.plaintext)).toEqual(t.hash);
  });

  it('two calls produce different tokens (256 bits of entropy)', () => {
    const a = generateVendorPortalToken();
    const b = generateVendorPortalToken();
    expect(a.plaintext).not.toEqual(b.plaintext);
    expect(a.hash).not.toEqual(b.hash);
  });
});
