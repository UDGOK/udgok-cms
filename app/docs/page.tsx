import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { BottomCTA } from '@/components/marketing/BottomCTA';

export const metadata = {
  title: 'Docs — UDGOK CMS',
  description: 'Technical documentation for UDGOK CMS — setup, integrations, API reference.',
};

const sections = [
  {
    title: 'Quick start',
    items: ['Installation', 'First workspace', 'Your first project', 'First pay app'],
  },
  {
    title: 'Core concepts',
    items: ['Workspaces & members', 'Clients, deals, projects', 'Schedule of values', 'Pay app lifecycle'],
  },
  {
    title: 'Features',
    items: ['GPS photos', 'Barcode & QR scanning', 'Internal messages', 'Team presence', 'PWA & offline'],
  },
  {
    title: 'API reference',
    items: ['Authentication', 'Workspaces', 'Projects', 'Pay apps', 'Photos'],
  },
  {
    title: 'Integrations',
    items: ['Clerk (auth)', 'Vercel Blob (files)', 'Resend (email)', 'Postgres / Neon'],
  },
  {
    title: 'Operations',
    items: ['Backup & restore', 'Export / import', 'Master admin', 'System health'],
  },
];

export default function DocsPage() {
  return (
    <MarketingPageShell>
      <MarketingNav />

      <section className="px-5 md:px-8 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Documentation'}
          </div>
          <h1 className="font-black tracking-[-0.03em] text-5xl sm:text-6xl md:text-7xl leading-[0.95] mb-5">
            UDGOK <span className="font-serif italic text-orange-d">docs.</span>
          </h1>
          <p className="text-ink-70 text-lg md:text-xl max-w-2xl">
            Everything you need to set up, integrate, and run UDGOK CMS for your crew.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 md:py-16 bg-paper border-t-2 border-ink">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {sections.map((s) => (
            <div key={s.title} className="bg-cream-2 border-2 border-line p-5 md:p-6 hover:border-ink transition-colors">
              <h2 className="font-extrabold text-base md:text-lg mb-3 tracking-tight">{s.title}</h2>
              <ul className="space-y-2">
                {s.items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[13px] text-ink-70 hover:text-orange-d flex items-center gap-2 group">
                      <span className="text-ink-30 group-hover:text-orange-d">→</span>
                      <span className="group-hover:underline">{item}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-ink text-cream border-2 border-orange p-6 md:p-8">
            <div className="text-2xl mb-2">🚀</div>
            <h2 className="font-black text-2xl md:text-3xl tracking-[-0.02em] mb-2">
              API coming <span className="font-serif italic text-orange">soon.</span>
            </h2>
            <p className="text-cream/70 text-[14px] mb-5">
              Public REST API with full read/write access to workspaces, projects, pay apps, and photos. Sign up below to get notified.
            </p>
            <Link
              href="/sign-up"
              className="inline-block px-5 py-3 bg-orange text-paper border-2 border-orange text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d hover:border-orange-d"
            >
              Notify me
            </Link>
          </div>
        </div>
      </section>

      <BottomCTA />
      <MarketingFooter />
    </MarketingPageShell>
  );
}
