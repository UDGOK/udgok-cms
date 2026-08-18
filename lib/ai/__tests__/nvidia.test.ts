import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNvidiaConfigured } from '../nvidia';

describe('isNvidiaConfigured', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when NVIDIA_API_KEY is set', () => {
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test-123');
    expect(isNvidiaConfigured()).toBe(true);
  });

  it('returns true when UDGOK_CMS_NVIDIA_API_KEY is set', () => {
    vi.stubEnv('UDGOK_CMS_NVIDIA_API_KEY', 'nvapi-test-456');
    expect(isNvidiaConfigured()).toBe(true);
  });

  it('returns true with the hardcoded fallback (always-on)', () => {
    // Even with no env vars set, the hardcoded fallback keeps it on
    expect(isNvidiaConfigured()).toBe(true);
  });
});
