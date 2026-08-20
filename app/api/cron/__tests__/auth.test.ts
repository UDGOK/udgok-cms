/**
 * Cron auth — covers the constant-time compare + fail-closed
 * behavior of authorizeCronRequest.
 *
 * Critical because cron routes mutate production data and are
 * the first thing anyone tries to attack once they find the
 * URL pattern. Every cron route goes through this helper.
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('authorizeCronRequest', () => {
  let mod: typeof import('../_auth');
  beforeEach(async () => {
    mod = await import('../_auth');
  });

  it('returns false when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    expect(mod.authorizeCronRequest('Bearer abc')).toBe(false);
  });

  it('returns false when no Authorization header is sent', () => {
    process.env.CRON_SECRET = 'test-secret-12345';
    expect(mod.authorizeCronRequest(null)).toBe(false);
  });

  it('returns false when header is not Bearer scheme', () => {
    process.env.CRON_SECRET = 'test-secret-12345';
    expect(mod.authorizeCronRequest('Basic dXNlcjpwYXNz')).toBe(false);
  });

  it('returns false on wrong secret (same length)', () => {
    process.env.CRON_SECRET = 'test-secret-12345';
    expect(mod.authorizeCronRequest('Bearer test-secret-67890')).toBe(false);
  });

  it('returns false on wrong secret (different length)', () => {
    process.env.CRON_SECRET = 'test-secret-12345';
    expect(mod.authorizeCronRequest('Bearer short')).toBe(false);
  });

  it('returns true on correct secret', () => {
    process.env.CRON_SECRET = 'test-secret-12345';
    expect(mod.authorizeCronRequest('Bearer test-secret-12345')).toBe(true);
  });
});
