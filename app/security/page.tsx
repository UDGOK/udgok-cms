import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { BottomCTA } from '@/components/marketing/BottomCTA';

export const metadata = {
  title: 'Security — UDGOK CMS',
  description: 'How UDGOK CMS keeps your data secure.',
};

const features = [
  {
    icon: '🔐',
    title: 'SOC 2 Type II infrastructure',
    body: 'All of our underlying providers (Clerk, Vercel, Neon, Vercel Blob, Stripe) are SOC 2 Type II certified.',
  },
  {
    icon: '🛡',
    title: 'Encrypted at rest and in transit',
    body: 'TLS 1.2+ everywhere. Database encryption at rest via AES-256. File storage encrypted at rest.',
  },
  {
    icon: '🔑',
    title: 'SSO available on Enterprise',
    body: 'Connect your existing identity provider (Okta, Azure AD, Google Workspace) for single sign-on and SCIM provisioning.',
  },
  {
    icon: '📋',
    title: 'Audit log on Enterprise',
    body: 'Every action — who created what, who viewed what, who changed what — is logged and exportable.',
  },
  {
    icon: '🌍',
    title: 'Data residency',
    body: 'By default, data is stored in the U.S. (us-east-1). EU residency available on Enterprise.',
  },
  {
    icon: '🚨',
    title: 'Incident response',
    body: 'We have a documented incident response plan. Critical incidents trigger an email to all affected customers within 24 hours.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingPageShell>
      <MarketingNav />

      <section className="px-5 md:px-8 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Security'}
          </div>
          <h1 className="font-black tracking-[-0.03em] text-5xl sm:text-6xl md:text-7xl leading-[0.95] mb-5">
            Your data, <span className="font-serif italic text-orange-d">secure.</span>
          </h1>
          <p className="text-ink-70 text-lg md:text-xl max-w-2xl">
            Construction projects involve real money. Here&apos;s how we keep your workspace data safe.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 md:py-16 bg-paper border-t-2 border-ink">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-cream-2 border-2 border-line p-5 md:p-6">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h2 className="font-extrabold text-base md:text-lg mb-2 tracking-tight">{f.title}</h2>
                <p className="text-[13px] text-ink-70 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-20">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-cream-2 border-2 border-ink p-6">
            <h2 className="font-extrabold text-lg mb-3">Responsible disclosure</h2>
            <p className="text-[14px] text-ink-70 leading-relaxed mb-3">
              Found a security issue? We want to hear from you. Email{' '}
              <a href="mailto:security@udgok.com" className="text-orange-d underline">
                security@udgok.com
              </a>{' '}
              with a description and reproduction steps. We respond within 24 hours and will work with you on a fix.
            </p>
          </div>
          <div className="bg-cream-2 border-2 border-ink p-6">
            <h2 className="font-extrabold text-lg mb-3">Sub-processors</h2>
            <p className="text-[14px] text-ink-70 leading-relaxed">
              We use the following sub-processors: Clerk (auth), Vercel (hosting), Neon (database), Vercel Blob (file storage), Stripe (billing), Resend (email). Each has signed a Data Processing Addendum.
            </p>
          </div>
        </div>
      </section>

      <BottomCTA />
      <MarketingFooter />
    </MarketingPageShell>
  );
}
