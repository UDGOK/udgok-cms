import { LegalPage } from '@/components/marketing/LegalPage';

export const metadata = {
  title: 'Privacy — UDGOK CMS',
  description: 'UDGOK CMS privacy policy — what we collect, how we use it, and your rights.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="// Privacy policy"
      title="Your data, your rights."
      subtitle="UDGOK CMS is built for contractors, not data brokers. Here's exactly what we collect, why, and what you can do with it."
      lastUpdated="January 2026"
      sections={[
        {
          heading: 'What we collect',
          body: [
            'Account info: name, email, and avatar URL from Clerk (our auth provider). We use this to sign you in and show your name to teammates.',
            'Workspace data: projects, clients, files, photos, pay apps, and any content you create or upload. This is your data — you own it.',
            'Usage telemetry: which pages you visit, which features you use, and crash reports. We use this to fix bugs and improve the product.',
            'Billing info: handled by Stripe. We never see your credit card number. We store your billing email and the last 4 digits of your card.',
          ],
        },
        {
          heading: 'How we use it',
          body: [
            'To provide the service. We use your workspace data to render your projects, pay apps, and photos. We use Clerk for sign-in. We use Stripe for billing. We use Resend to send transactional emails (pay app share links, invitations).',
            'To improve the product. We look at usage data in aggregate to find features that aren\'t working and fix them.',
            'We do not sell your data. We do not show ads. We do not share your workspace data with third parties except as required to operate the service (e.g. Vercel hosts our app, Neon hosts our database, Vercel Blob stores your files).',
          ],
        },
        {
          heading: 'Where it lives',
          body: 'Your data is stored in production-grade cloud infrastructure: Neon Postgres (database), Vercel Blob (files), Clerk (auth), Stripe (billing). All providers are SOC 2 Type II certified. Data is encrypted at rest and in transit. Database backups are taken daily and retained for 30 days.',
        },
        {
          heading: 'Your rights',
          body: [
            'Access: you can export your full workspace as JSON at any time (Pro and Enterprise plans).',
            'Delete: you can delete your account from workspace settings. We will permanently delete your data within 30 days.',
            'Correct: edit anything in your workspace at any time. There\'s no "frozen" data.',
            'Port: export to JSON, then import into a different system. We don\'t lock you in.',
          ],
        },
        {
          heading: 'Cookies & tracking',
          body: 'We use a single first-party cookie for authentication (set by Clerk). We do not use third-party analytics trackers like Google Analytics or Facebook Pixel. We do not use advertising cookies.',
        },
        {
          heading: 'Children',
          body: 'UDGOK CMS is for adults running businesses. We do not knowingly collect data from anyone under 16. If you believe a child has signed up, contact us and we will delete the account.',
        },
        {
          heading: 'Changes',
          body: 'If we change this policy in a material way, we will email you and show a banner in the app. Continued use after the change means you accept the new policy. The previous version is always available in our changelog.',
        },
        {
          heading: 'Contact',
          body: 'Questions? Email privacy@udgok.com. We respond within 48 hours.',
        },
      ]}
    />
  );
}
