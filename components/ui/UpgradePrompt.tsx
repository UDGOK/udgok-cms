import { Plan } from '@prisma/client';
import { PLAN_INFO, type FeatureKey, getUpgradePrompt, hasFeature } from '@/lib/workspace/tier';
import { TierBadge } from './TierBadge';

/**
 * Wrap any gated feature. Renders the children if the workspace's plan
 * includes the feature, otherwise renders a tasteful upgrade prompt.
 */
export function FeatureGate({
  plan,
  feature,
  children,
  showCurrentPlan = true,
  isMasterAdmin = false,
}: {
  plan: Plan;
  feature: FeatureKey;
  children: React.ReactNode;
  showCurrentPlan?: boolean;
  isMasterAdmin?: boolean;
}) {
  if (hasFeature(plan, feature, isMasterAdmin)) {
    return <>{children}</>;
  }

  const prompt = getUpgradePrompt(feature);
  if (!prompt) return <>{children}</>;

  return (
    <div className="bg-cream-2 border-2 border-dashed border-line p-8 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="font-extrabold text-[18px] mb-1">
        {prompt.label} feature
      </h3>
      <p className="text-[12px] text-ink-70 max-w-md mx-auto mb-4">
        {humanizeFeature(feature)} is included in the {prompt.label} plan
        {prompt.tier === 'PRO' ? ' ($49/mo)' : ''}. Upgrade to unlock it across this workspace.
      </p>
      <div className="flex items-center justify-center gap-2">
        <TierBadge plan={prompt.tier} size="md" />
        {showCurrentPlan ? (
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            current: {PLAN_INFO[plan].label}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        disabled
        className="mt-5 px-5 py-2.5 bg-ink text-cream border-2 border-ink text-[10px] font-extrabold uppercase tracking-[0.15em] opacity-60 cursor-not-allowed"
        title="Billing is coming soon — contact us to upgrade"
      >
        Upgrade to {prompt.label} (soon)
      </button>
    </div>
  );
}

function humanizeFeature(f: FeatureKey): string {
  const map: Partial<Record<FeatureKey, string>> = {
    gps_photos: 'GPS-tagged site photos',
    barcode_scan: 'Barcode & QR scanning',
    export_import: 'Data export & import',
    backup_restore: 'Workspace backup & restore',
    sso: 'Single sign-on (SSO)',
    audit_log_export: 'Audit log export',
    custom_branding: 'Custom branding',
  };
  return map[f] ?? f;
}
