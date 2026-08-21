'use client';

import { useEffect, useState } from 'react';

/**
 * TrialWelcome — client component that reads the plan from
 * sessionStorage (set by /sign-up?plan=pro or /sign-up?plan=enterprise)
 * and renders a "you're starting a Pro trial" banner so the user
 * knows their workspace will be created with Pro features for 14 days.
 *
 * The actual plan + trialEndsAt are written server-side by
 * createWorkspaceAction.
 */
export function TrialWelcome() {
  const [plan, setPlan] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('udgok_signup_plan');
      if (stored === 'pro' || stored === 'enterprise') {
        setPlan(stored);
      }
    } catch {
      // sessionStorage unavailable
    }
    setHydrated(true);
  }, []);

  if (!hydrated || !plan) return null;
  const label =
    plan === 'pro'
      ? '14 days of Pro — GPS photos, barcode scanning, exports, all unlocked'
      : '14 days of Enterprise — SSO, audit log, custom branding, all unlocked';

  return (
    <div className="bg-orange text-paper border-2 border-orange-d p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">⚡</div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-paper/80 font-bold mb-1">
            {'// Pro trial'}
          </div>
          <div className="font-extrabold text-[15px] leading-tight">{label}</div>
          <div className="text-[12px] text-paper/80 mt-1.5 leading-relaxed">
            No credit card. We&apos;ll email you 3 days before the trial ends so you can decide.
          </div>
        </div>
      </div>
    </div>
  );
}
