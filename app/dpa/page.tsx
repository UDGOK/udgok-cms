import { LegalPage } from '@/components/marketing/LegalPage';

export const metadata = {
  title: 'Data Processing Addendum — UDGOK CMS',
  description: 'UDGOK CMS Data Processing Addendum for GDPR / CCPA compliance.',
};

export default function DPAPage() {
  return (
    <LegalPage
      eyebrow="// Data Processing Addendum"
      title="GDPR & CCPA compliant."
      subtitle="This Data Processing Addendum forms part of our Terms of Service and applies when you process personal data through UDGOK CMS."
      lastUpdated="January 2026"
      sections={[
        {
          heading: 'Definitions',
          body: '"Personal Data", "Processing", "Controller", "Processor", "Data Subject", and "Supervisory Authority" have the meanings given in the EU General Data Protection Regulation (GDPR).',
        },
        {
          heading: 'Roles',
          body: 'You are the Data Controller. We are the Data Processor. We process Personal Data only on your documented instructions.',
        },
        {
          heading: 'Scope',
          body: 'This DPA applies to Personal Data you submit to UDGOK CMS, including names, email addresses, phone numbers, project addresses, file metadata, and GPS coordinates of uploaded photos.',
        },
        {
          heading: 'Sub-processors',
          body: 'We use the following sub-processors: Clerk (auth), Vercel (hosting), Neon (database), Vercel Blob (file storage), Stripe (billing), Resend (email). We notify you at least 30 days before adding a new sub-processor.',
        },
        {
          heading: 'Security',
          body: 'We implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk, including encryption at rest and in transit, access controls, and regular security reviews.',
        },
        {
          heading: 'Data Subject requests',
          body: 'We will assist you in responding to Data Subject requests for access, correction, deletion, portability, and objection. We respond within 5 business days.',
        },
        {
          heading: 'Breach notification',
          body: 'We will notify you without undue delay, and in any case within 48 hours, of becoming aware of a Personal Data breach affecting your data.',
        },
        {
          heading: 'Data deletion',
          body: 'On termination, we will delete all Personal Data within 30 days, except where retention is required by law.',
        },
        {
          heading: 'Audits',
          body: 'Enterprise customers may audit our compliance with this DPA once per year, with 30 days notice. We will also provide SOC 2 Type II reports on request.',
        },
        {
          heading: 'Governing law',
          body: 'This DPA is governed by the laws of the State of Texas, USA. EU customers may also rely on the standard contractual clauses approved by the European Commission.',
        },
      ]}
    />
  );
}
