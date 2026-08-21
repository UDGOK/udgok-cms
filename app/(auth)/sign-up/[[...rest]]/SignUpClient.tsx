'use client';

import { useEffect } from 'react';
import { SignUp } from '@clerk/nextjs';

export function SignUpClient({ plan }: { plan?: string | null }) {
  // Persist the selected plan across the Clerk flow. The /onboarding
  // page reads this and tells the workspace create action to set the
  // Pro trial window. We use sessionStorage so it dies after the
  // browser tab closes (we don't want stale plans to leak into a
  // future sign-in).
  useEffect(() => {
    if (plan === 'pro' || plan === 'enterprise') {
      try {
        sessionStorage.setItem('udgok_signup_plan', plan);
      } catch {
        // sessionStorage may be unavailable in private browsing
      }
    }
  }, [plan]);

  // Build the post-signup redirect. Clerk redirects to /workspaces
  // by default; we want to push them to /onboarding so we can capture
  // the plan and create their first workspace.
  const forceRedirectUrl = '/onboarding';

  return (
    <SignUp
      forceRedirectUrl={forceRedirectUrl}
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'shadow-none border-2 border-ink bg-paper',
          formButtonPrimary:
            'bg-orange hover:bg-orange-d border-2 border-orange hover:border-orange-d text-[11px] font-extrabold uppercase tracking-[0.15em] py-3',
          headerTitle: 'hidden',
          headerSubtitle: 'hidden',
          socialButtonsBlockButton:
            'border-2 border-line hover:border-ink hover:bg-cream-2 text-ink',
          socialButtonsBlockButtonText: 'font-extrabold text-[12px] uppercase tracking-[0.1em]',
          formFieldInput:
            'border-2 border-line focus:border-ink focus:ring-0',
          formFieldLabel: 'text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-70',
          footerActionLink: 'text-orange-d hover:underline font-bold',
          dividerLine: 'bg-line',
          dividerText: 'text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50',
          formResendCodeLink: 'text-orange-d hover:underline',
        },
      }}
    />
  );
}
