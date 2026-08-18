import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDeepSeekConfigured } from '../deepseek';

describe('isDeepSeekConfigured', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when DEEPSEEK_API_KEY is set', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test-123');
    expect(isDeepSeekConfigured()).toBe(true);
  });

  it('returns true when UDGOK_CMS_DEEPSEEK_API_KEY is set', () => {
    vi.stubEnv('UDGOK_CMS_DEEPSEEK_API_KEY', 'sk-test-456');
    expect(isDeepSeekConfigured()).toBe(true);
  });

  it('returns true with the hardcoded fallback (always-on)', () => {
    // Even with no env vars set, the hardcoded fallback keeps it on
    expect(isDeepSeekConfigured()).toBe(true);
  });
});
