import { LegalPage } from '@/components/marketing/LegalPage';

export const metadata = {
  title: 'Terms — UDGOK CMS',
  description: 'UDGOK CMS terms of service.',
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="// Terms of service"
      title="The fine print."
      subtitle="By using UDGOK CMS, you agree to these terms. They're written in plain English because we hate legalese as much as you do."
      lastUpdated="January 2026"
      sections={[
        {
          heading: 'You must be 18 or older',
          body: 'UDGOK CMS is a business tool. You need to be 18 or older (or the age of majority in your jurisdiction) to use it. If you\'re signing up on behalf of a company, you confirm you have authority to do so.',
        },
        {
          heading: 'You own your data',
          body: 'You retain full ownership of all data you create, upload, or store in UDGOK CMS. We claim no rights to your projects, files, photos, or any other content. You can export it all as JSON at any time.',
        },
        {
          heading: 'You can\'t use it for illegal stuff',
          body: 'You agree not to use UDGOK CMS for any unlawful purpose, to upload content that infringes on someone else\'s rights, or to attempt to disrupt the service. If you do, we may suspend your account.',
        },
        {
          heading: 'We\'ll try our best, but…',
          body: 'We aim for 99.9% uptime but don\'t guarantee it. We\'re not liable for downtime, data loss, or any indirect damages. We back up your data daily but you should also keep your own backups (Pro and Enterprise plans include one-click export).',
        },
        {
          heading: 'Plans and billing',
          body: 'Starter is free forever. Pro and Enterprise are billed monthly or annually. You can cancel any time. We don\'t refund partial months. If you upgrade mid-cycle, we prorate. If you downgrade, you keep Pro features until the end of your billing period.',
        },
        {
          heading: 'We can change these terms',
          body: 'If we make material changes, we\'ll email you at least 30 days in advance. The previous version is always available in our changelog. Continued use after the change means you accept the new terms.',
        },
        {
          heading: 'You can leave any time',
          body: 'You can delete your account and all your data from workspace settings. We\'ll permanently remove it within 30 days.',
        },
        {
          heading: 'Governing law',
          body: 'These terms are governed by the laws of the State of Texas, USA. Any disputes will be resolved in Travis County, Texas.',
        },
        {
          heading: 'Contact',
          body: 'Questions? Email legal@udgok.com.',
        },
      ]}
    />
  );
}
