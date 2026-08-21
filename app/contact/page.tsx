import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { ContactForm } from './ContactForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Contact — UDGOK CMS',
  description: 'Talk to us about pricing, your team, or a custom demo. We read every message.',
};

interface ContactPageProps {
  searchParams: { plan?: string; source?: string };
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const source = searchParams.source ?? 'contact';
  const plan = searchParams.plan;

  return (
    <MarketingPageShell>
      <MarketingNav />

      <section className="px-5 md:px-8 py-12 md:py-20 bg-cream">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
              {'// Contact'}
            </div>
            <h1 className="font-black tracking-[-0.02em] text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-5">
              {source === 'enterprise' ? (
                <>
                  Let&apos;s talk <span className="font-serif italic text-orange-d">enterprise.</span>
                </>
              ) : (
                <>
                  Talk to a <span className="font-serif italic text-orange-d">real person.</span>
                </>
              )}
            </h1>
            <p className="text-ink-70 text-base md:text-lg mb-6 leading-relaxed">
              {source === 'enterprise'
                ? 'Tell us about your team, regions, and integration needs. Yasir personally walks every enterprise deal — you’ll hear back within 1 business day.'
                : 'Sales, support, partnership, press, or just curious — pick a topic and we’ll route you to the right person.'}
            </p>

            <ul className="space-y-2.5 mb-6">
              <Bullet>Avg. response time: under 4 business hours</Bullet>
              <Bullet>Yasir reads every inbound — no SDR team, no ticket queue</Bullet>
              <Bullet>U.S.-based, no outsourced support</Bullet>
            </ul>

            <div className="bg-paper border-2 border-line p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 font-bold mb-1">
                Or just email us
              </div>
              <a
                href="mailto:hello@udgok.com"
                className="font-extrabold text-orange-d hover:underline"
              >
                hello@udgok.com
              </a>
              <div className="text-[11px] text-ink-50 mt-1 font-mono">
                For enterprise:{' '}
                <a href="mailto:enterprise@udgok.com" className="underline hover:text-ink">
                  enterprise@udgok.com
                </a>
              </div>
            </div>
          </div>

          <ContactForm
            source={source}
            plan={plan}
            page="/contact"
            title={source === 'enterprise' ? 'Request enterprise pricing' : 'Send us a message'}
            subtitle={
              source === 'enterprise'
                ? 'Tell us about your team and what you need. We’ll come back with custom pricing within 1 business day.'
                : 'Sales, support, or just curious — we read every message.'
            }
          />
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-20 bg-paper border-t-2 border-ink">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Other ways to get in touch'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OtherCard
              eyebrow="// Sales"
              title="Pricing & quotes"
              body="Want a custom quote for 10+ users, SSO, or a region-specific deployment?"
              cta={{ label: 'Contact sales →', href: '/contact?source=enterprise' }}
            />
            <OtherCard
              eyebrow="// Help"
              title="Already a customer"
              body="Sign in to chat with our team, or browse the help center for self-serve answers."
              cta={{ label: 'Open help center →', href: '/help' }}
            />
            <OtherCard
              eyebrow="// Docs"
              title="Building with UDGOK"
              body="API reference, data model, integrations, and the public roadmap."
              cta={{ label: 'Read the docs →', href: '/docs' }}
            />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </MarketingPageShell>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[14px]">
      <span className="w-5 h-5 flex-shrink-0 bg-orange text-paper flex items-center justify-center text-[11px] font-black">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function OtherCard({
  eyebrow,
  title,
  body,
  cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
}) {
  return (
    <div className="bg-cream-2 border-2 border-line p-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 font-bold mb-2">
        {eyebrow}
      </div>
      <h3 className="font-extrabold text-[16px] mb-2">{title}</h3>
      <p className="text-[12px] text-ink-70 mb-4 leading-relaxed">{body}</p>
      <Link
        href={cta.href}
        className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:underline"
      >
        {cta.label}
      </Link>
    </div>
  );
}
