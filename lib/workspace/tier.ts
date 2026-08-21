import { Plan } from '@prisma/client';

/**
 * Feature flags. Every premium capability is gated through this map so
 * we can check `hasFeature(plan, 'gps_photos')` and have a single source
 * of truth for what's in each tier.
 *
 * When you wire this to Clerk billing later, the only thing that changes
 * is where `plan` comes from (read from the Clerk subscription) — the
 * feature map and the `requiresTier` helper stay the same.
 */
export type FeatureKey =
  // Currently free for everyone
  | 'crm'
  | 'projects'
  | 'pay_apps'
  | 'team_presence'
  | 'subcontractors'
  | 'activity_log'
  | 'pwa_install'
  | 'offline_drafts'
  | 'bottom_sheets'
  | 'internal_messages'
  // Pro tier
  | 'gps_photos'
  | 'barcode_scan'
  | 'export_import'
  | 'backup_restore'
  // Enterprise tier
  | 'sso'
  | 'audit_log_export'
  | 'custom_branding';

const TIER_RANK: Record<Plan, number> = {
  STARTER: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

/**
 * Minimum tier required for each gated feature. Features not in this
 * map are available to all plans.
 */
const FEATURE_MIN_TIER: Partial<Record<FeatureKey, Plan>> = {
  gps_photos: 'PRO',
  barcode_scan: 'PRO',
  export_import: 'PRO',
  backup_restore: 'PRO',
  sso: 'ENTERPRISE',
  audit_log_export: 'ENTERPRISE',
  custom_branding: 'ENTERPRISE',
};

export function hasFeature(
  plan: Plan | null | undefined,
  feature: FeatureKey,
  isMasterAdmin = false,
  trialEndsAt?: Date | string | null,
): boolean {
  // Master admins always have access to every feature, regardless of
  // plan. This lets the platform owner test what Starter looks like
  // (by switching a workspace to Starter) without losing their own
  // access to Pro/Enterprise features.
  if (isMasterAdmin) return true;
  if (!plan) return false;
  const required = FEATURE_MIN_TIER[feature];
  if (!required) return true; // No gating = free for all
  // If on a trial with PRO plan access, the trial window unlocks Pro
  // features. The trial overrides the plan tier for feature checks
  // ONLY when the trial was a paid Pro trial (i.e. plan === 'PRO').
  if (plan === 'PRO' && trialEndsAt) {
    const t = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) {
      return true;
    }
  }
  return TIER_RANK[plan] >= TIER_RANK[required];
}

export function requiresTier(userPlan: Plan, required: Plan): boolean {
  return TIER_RANK[userPlan] >= TIER_RANK[required];
}

/**
 * True if the workspace is currently in an active Pro trial
 * (plan === 'PRO' AND trialEndsAt is in the future).
 */
export function isOnProTrial(
  plan: Plan | null | undefined,
  trialEndsAt: Date | string | null | undefined,
): boolean {
  if (plan !== 'PRO' || !trialEndsAt) return false;
  const t = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  return !Number.isNaN(t.getTime()) && t.getTime() > Date.now();
}

/**
 * Returns the number of full days remaining in the trial, or 0 if not on
 * a trial. Used to drive the "Pro trial · X days remaining" banner.
 */
export function trialDaysRemaining(
  trialEndsAt: Date | string | null | undefined,
): number {
  if (!trialEndsAt) return 0;
  const t = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  if (Number.isNaN(t.getTime())) return 0;
  const ms = t.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export const PLAN_INFO: Record<Plan, { label: string; price: string; tagline: string; color: string }> = {
  STARTER: {
    label: 'Starter',
    price: '$0',
    tagline: 'Solo or small crews getting started',
    color: 'bg-ink-30 text-ink',
  },
  PRO: {
    label: 'Pro',
    price: '$49/mo',
    tagline: 'For active contractors running multiple jobs',
    color: 'bg-orange text-paper',
  },
  ENTERPRISE: {
    label: 'Enterprise',
    price: 'Custom',
    tagline: 'For multi-crew builders with custom needs',
    color: 'bg-ink text-cream',
  },
};

/**
 * List of features for the upgrade prompt on a gated feature.
 */
export function getUpgradePrompt(feature: FeatureKey): { tier: Plan; label: string } | null {
  const required = FEATURE_MIN_TIER[feature];
  if (!required) return null;
  return { tier: required, label: PLAN_INFO[required].label };
}
