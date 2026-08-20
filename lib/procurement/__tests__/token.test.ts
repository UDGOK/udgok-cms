import { describe, it, expect } from 'vitest';
import { generateRfqToken, hashIp, safeEqualHex, sha256 } from '../token';

describe('token module', () => {
  describe('sha256', () => {
    it('produces deterministic 64-char hex output', () => {
      const a = sha256('hello world');
      const b = sha256('hello world');
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes output for different input', () => {
      expect(sha256('hello')).not.toBe(sha256('hello!'));
    });
  });

  describe('safeEqualHex', () => {
    it('returns true for equal hex', () => {
      const a = 'deadbeef';
      const b = 'deadbeef';
      expect(safeEqualHex(a, b)).toBe(true);
    });

    it('returns false for different hex', () => {
      expect(safeEqualHex('deadbeef', 'deadbee0')).toBe(false);
    });

    it('returns false for different length', () => {
      expect(safeEqualHex('a', 'aa')).toBe(false);
    });

    it('returns true for empty strings (both empty)', () => {
      expect(safeEqualHex('', '')).toBe(true);
    });
  });

  describe('generateRfqToken', () => {
    it('returns token, tokenHash, tokenPrefix', () => {
      const out = generateRfqToken();
      expect(out.token).toBeDefined();
      expect(out.tokenHash).toBeDefined();
      expect(out.tokenPrefix).toBeDefined();
    });

    it('token is URL-safe base64', () => {
      const { token } = generateRfqToken();
      // base64url: A-Z a-z 0-9 - _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('tokenHash is 64-char hex (sha256 of token)', () => {
      const { token, tokenHash } = generateRfqToken();
      expect(tokenHash).toBe(sha256(token));
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('tokenPrefix is first 8 chars of token', () => {
      const { token, tokenPrefix } = generateRfqToken();
      expect(tokenPrefix).toBe(token.slice(0, 8));
    });

    it('tokens are unique across calls', () => {
      const a = generateRfqToken();
      const b = generateRfqToken();
      expect(a.token).not.toBe(b.token);
    });
  });

  describe('hashIp', () => {
    it('produces 64-char hex output', () => {
      const h = hashIp('203.0.113.42', 'salt-1');
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes with salt', () => {
      const a = hashIp('1.2.3.4', 'salt-a');
      const b = hashIp('1.2.3.4', 'salt-b');
      expect(a).not.toBe(b);
    });

    it('changes with IP', () => {
      const a = hashIp('1.2.3.4', 'salt');
      const b = hashIp('1.2.3.5', 'salt');
      expect(a).not.toBe(b);
    });
  });
});
