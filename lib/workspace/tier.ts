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

export function hasFeature(plan: Plan | null | undefined, feature: FeatureKey): boolean {
  if (!plan) return false;
  const required = FEATURE_MIN_TIER[feature];
  if (!required) return true; // No gating = free for all
  return TIER_RANK[plan] >= TIER_RANK[required];
}

export function requiresTier(userPlan: Plan, required: Plan): boolean {
  return TIER_RANK[userPlan] >= TIER_RANK[required];
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
