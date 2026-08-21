import { prisma } from '@/lib/db/client';
import type { PlanData } from '@/components/marketing/PricingSection';

/**
 * Aggregate stats for the marketing landing page. Shown as social
 * proof. All counts come from the live database.
 */
export async function getMarketingData() {
  const [userCount, workspaceCount, projectCount, payAppCount] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.project.count(),
    prisma.payApp.count(),
  ]);

  return {
    stats: {
      users: userCount,
      workspaces: workspaceCount,
      projects: projectCount,
      payApps: payAppCount,
    },
    plans: getPlans(),
  };
}

function getPlans(): PlanData[] {
  return [
    {
      name: 'Starter',
      price: '$0',
      per: '/forever',
      tagline: 'Solo or small crews getting started.',
      features: [
        { label: 'Unlimited projects & clients', included: true },
        { label: 'Pay apps + PDF generation', included: true },
        { label: 'Team presence + activity log', included: true },
        { label: 'PWA install + offline drafts', included: true },
        { label: 'Internal messages', included: true },
        { label: 'GPS-tagged site photos', included: false },
        { label: 'Barcode & QR scanning', included: false },
        { label: 'Export & backup', included: false },
      ],
      cta: { label: 'Start free', href: '/sign-up' },
      featured: false,
    },
    {
      name: 'Pro',
      price: '$49',
      per: '/user/mo',
      tagline: 'For active contractors running multiple jobs.',
      features: [
        { label: 'Everything in Starter', included: true },
        { label: 'GPS-tagged site photos', included: true },
        { label: 'Barcode & QR scanning', included: true },
        { label: 'Export & import (JSON)', included: true },
        { label: 'Backup & restore', included: true },
        { label: 'Priority support', included: true },
        { label: 'Custom domain (coming soon)', included: true },
      ],
      cta: { label: 'Start 14-day trial', href: '/sign-up?plan=pro' },
      featured: true,
      badge: '⭐ Most popular',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      per: '',
      tagline: 'Multi-crew builders with custom needs.',
      features: [
        { label: 'Everything in Pro', included: true },
        { label: 'Single sign-on (SSO)', included: true },
        { label: 'Audit log export', included: true },
        { label: 'Custom branding', included: true },
        { label: 'Dedicated success manager', included: true },
        { label: 'SLA + 99.9% uptime', included: true },
      ],
      cta: { label: 'Contact sales', href: '/contact?plan=enterprise&source=enterprise' },
      featured: false,
    },
  ];
}
