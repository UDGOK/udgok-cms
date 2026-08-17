import { describe, it, expect } from 'vitest';
import { hasFeature, requiresTier, PLAN_INFO, getUpgradePrompt } from '../tier';

describe('tier gating', () => {
  it('Starter plan has all free features', () => {
    expect(hasFeature('STARTER', 'crm')).toBe(true);
    expect(hasFeature('STARTER', 'pwa_install')).toBe(true);
    expect(hasFeature('STARTER', 'offline_drafts')).toBe(true);
    expect(hasFeature('STARTER', 'bottom_sheets')).toBe(true);
    expect(hasFeature('STARTER', 'internal_messages')).toBe(true);
  });

  it('Starter plan does NOT have Pro features', () => {
    expect(hasFeature('STARTER', 'gps_photos')).toBe(false);
    expect(hasFeature('STARTER', 'barcode_scan')).toBe(false);
    expect(hasFeature('STARTER', 'backup_restore')).toBe(false);
    expect(hasFeature('STARTER', 'export_import')).toBe(false);
  });

  it('Starter plan does NOT have Enterprise features', () => {
    expect(hasFeature('STARTER', 'sso')).toBe(false);
    expect(hasFeature('STARTER', 'audit_log_export')).toBe(false);
    expect(hasFeature('STARTER', 'custom_branding')).toBe(false);
  });

  it('Pro plan has all Starter + Pro features', () => {
    expect(hasFeature('PRO', 'crm')).toBe(true);
    expect(hasFeature('PRO', 'gps_photos')).toBe(true);
    expect(hasFeature('PRO', 'barcode_scan')).toBe(true);
    expect(hasFeature('PRO', 'backup_restore')).toBe(true);
    expect(hasFeature('PRO', 'export_import')).toBe(true);
    // but NOT Enterprise
    expect(hasFeature('PRO', 'sso')).toBe(false);
    expect(hasFeature('PRO', 'audit_log_export')).toBe(false);
  });

  it('Enterprise plan has everything', () => {
    expect(hasFeature('ENTERPRISE', 'crm')).toBe(true);
    expect(hasFeature('ENTERPRISE', 'gps_photos')).toBe(true);
    expect(hasFeature('ENTERPRISE', 'sso')).toBe(true);
    expect(hasFeature('ENTERPRISE', 'custom_branding')).toBe(true);
  });

  it('returns false for null/undefined plan', () => {
    expect(hasFeature(null, 'crm')).toBe(false);
    expect(hasFeature(undefined, 'crm')).toBe(false);
  });
});

describe('requiresTier', () => {
  it('Starter can not require anything higher than itself', () => {
    expect(requiresTier('STARTER', 'STARTER')).toBe(true);
    expect(requiresTier('STARTER', 'PRO')).toBe(false);
    expect(requiresTier('STARTER', 'ENTERPRISE')).toBe(false);
  });

  it('Pro meets Starter and Pro, not Enterprise', () => {
    expect(requiresTier('PRO', 'STARTER')).toBe(true);
    expect(requiresTier('PRO', 'PRO')).toBe(true);
    expect(requiresTier('PRO', 'ENTERPRISE')).toBe(false);
  });

  it('Enterprise meets everything', () => {
    expect(requiresTier('ENTERPRISE', 'STARTER')).toBe(true);
    expect(requiresTier('ENTERPRISE', 'PRO')).toBe(true);
    expect(requiresTier('ENTERPRISE', 'ENTERPRISE')).toBe(true);
  });
});

describe('PLAN_INFO', () => {
  it('defines all three plans with required fields', () => {
    expect(PLAN_INFO.STARTER.label).toBe('Starter');
    expect(PLAN_INFO.PRO.label).toBe('Pro');
    expect(PLAN_INFO.ENTERPRISE.label).toBe('Enterprise');
    for (const plan of ['STARTER', 'PRO', 'ENTERPRISE'] as const) {
      expect(PLAN_INFO[plan].label).toBeTruthy();
      expect(PLAN_INFO[plan].price).toBeTruthy();
      expect(PLAN_INFO[plan].tagline).toBeTruthy();
      expect(PLAN_INFO[plan].color).toBeTruthy();
    }
  });
});

describe('getUpgradePrompt', () => {
  it('returns null for free features', () => {
    expect(getUpgradePrompt('crm')).toBeNull();
    expect(getUpgradePrompt('pwa_install')).toBeNull();
  });

  it('returns Pro for Pro-tier features', () => {
    const prompt = getUpgradePrompt('gps_photos');
    expect(prompt?.tier).toBe('PRO');
    expect(prompt?.label).toBe('Pro');
  });

  it('returns Enterprise for Enterprise-tier features', () => {
    const prompt = getUpgradePrompt('sso');
    expect(prompt?.tier).toBe('ENTERPRISE');
    expect(prompt?.label).toBe('Enterprise');
  });
});
