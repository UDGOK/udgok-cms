/**
 * Trial-aware tier logic.
 *
 * The whole point of the trial is to give the user Pro features for
 * 14 days without billing. So `hasFeature(plan, feature, false, trialEndsAt)`
 * should return true for Pro features when:
 *   - plan === 'PRO' AND trialEndsAt is in the future
 *
 * Otherwise it falls back to the standard plan-based check.
 */

import { describe, it, expect } from 'vitest';
import { hasFeature, isOnProTrial, trialDaysRemaining } from '../tier';

describe('isOnProTrial', () => {
  it('returns true when plan is PRO and trialEndsAt is in the future', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(isOnProTrial('PRO', future)).toBe(true);
  });

  it('returns false when plan is STARTER even with a future trialEndsAt', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(isOnProTrial('STARTER', future)).toBe(false);
  });

  it('returns false when trialEndsAt is in the past', () => {
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(isOnProTrial('PRO', past)).toBe(false);
  });

  it('returns false when trialEndsAt is null', () => {
    expect(isOnProTrial('PRO', null)).toBe(false);
    expect(isOnProTrial('PRO', undefined)).toBe(false);
  });

  it('accepts ISO string for trialEndsAt', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isOnProTrial('PRO', future)).toBe(true);
  });
});

describe('trialDaysRemaining', () => {
  it('returns 0 for null/undefined', () => {
    expect(trialDaysRemaining(null)).toBe(0);
    expect(trialDaysRemaining(undefined)).toBe(0);
  });

  it('returns 0 for past dates', () => {
    const past = new Date(Date.now() - 1000);
    expect(trialDaysRemaining(past)).toBe(0);
  });

  it('returns the ceiling of days remaining', () => {
    // 13.5 days from now → 14 days
    const future = new Date(Date.now() + 13.5 * 24 * 60 * 60 * 1000);
    expect(trialDaysRemaining(future)).toBe(14);
  });

  it('returns at least 1 if even seconds remain', () => {
    const justFuture = new Date(Date.now() + 60_000);
    expect(trialDaysRemaining(justFuture)).toBeGreaterThanOrEqual(1);
  });
});

describe('hasFeature with trial', () => {
  it('unlocks Pro features during an active trial', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(hasFeature('PRO', 'gps_photos', false, future)).toBe(true);
    expect(hasFeature('PRO', 'barcode_scan', false, future)).toBe(true);
    expect(hasFeature('PRO', 'export_import', false, future)).toBe(true);
  });

  it('does NOT unlock Pro features after the trial ends + plan downgrade', () => {
    // The realistic scenario: when the trial ends, the cron job
    // (app/api/cron/send-trial-emails) downgrades plan to STARTER
    // and clears trialEndsAt. So a "post-trial" user is on STARTER
    // with no trialEndsAt — and Pro features must be denied.
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(hasFeature('STARTER', 'gps_photos', false, past)).toBe(false);
    expect(hasFeature('STARTER', 'barcode_scan', false, past)).toBe(false);
  });

  it('does NOT unlock Pro features on Starter plan even with future trialEndsAt', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // The trial pattern is: trialEndsAt is only set on the workspace
    // when plan === PRO, so this combination shouldn't happen. But
    // the gating is explicit: trialEndsAt only unlocks when plan is PRO.
    expect(hasFeature('STARTER', 'gps_photos', false, future)).toBe(false);
  });

  it('still respects master admin bypass', () => {
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(hasFeature('PRO', 'gps_photos', true, past)).toBe(true);
  });

  it('free features (no gate) are always allowed', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(hasFeature('STARTER', 'crm', false, future)).toBe(true);
    expect(hasFeature('STARTER', 'pay_apps', false, future)).toBe(true);
  });
});
