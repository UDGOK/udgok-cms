/**
 * TrialBanner — a top-of-app banner that shows when the workspace
 * is in a paid Pro trial. Displays the days remaining and a CTA
 * to upgrade. Self-hides when the trial is over.
 *
 * Renders nothing if:
 *   - not on PRO plan
 *   - no trialEndsAt
 *   - trial already ended
 *   - days remaining === 0
 */
import Link from 'next/link';

interface TrialBannerProps {
  workspaceSlug: string;
  plan: 'STARTER' | 'PRO' | 'ENTERPRISE';
  trialEndsAt: Date | string | null | undefined;
}

function daysRemaining(trialEndsAt: Date | string | null | undefined): number {
  if (!trialEndsAt) return 0;
  const t = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  if (Number.isNaN(t.getTime())) return 0;
  const ms = t.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function TrialBanner({ workspaceSlug, plan, trialEndsAt }: TrialBannerProps) {
  if (plan !== 'PRO') return null;
  const days = daysRemaining(trialEndsAt);
  if (days <= 0) return null;
  const urgent = days <= 3;
  return (
    <div
      className={`px-4 py-2 text-[12px] font-mono uppercase tracking-[0.1em] flex items-center justify-between gap-3 flex-wrap ${
        urgent
          ? 'bg-warning text-ink border-b-2 border-warning-d'
          : 'bg-orange text-paper border-b-2 border-orange-d'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-extrabold">⚡ Pro trial</span>
        <span>
          {days} day{days === 1 ? '' : 's'} remaining · GPS photos, barcode scanning, exports all unlocked
        </span>
      </div>
      <Link
        href={`/w/${workspaceSlug}/settings/billing`}
        className={`px-3 py-1 border-2 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
          urgent
            ? 'bg-ink text-cream border-ink hover:bg-paper hover:text-ink'
            : 'bg-paper text-ink border-paper hover:bg-ink hover:text-cream hover:border-ink'
        }`}
      >
        Upgrade now →
      </Link>
    </div>
  );
}
