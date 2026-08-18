import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { BottomCTA } from '@/components/marketing/BottomCTA';

export const metadata = {
  title: 'Help center — UDGOK CMS',
  description: 'Find answers to common questions about UDGOK CMS.',
};

const categories = [
  {
    title: 'Getting started',
    icon: '🚀',
    articles: [
      'How to create your first workspace',
      'Adding team members and subcontractors',
      'Connecting a client to a project',
      'Setting up your schedule of values',
      'Generating your first pay app',
    ],
  },
  {
    title: 'Foremen & field crews',
    icon: '🔨',
    articles: [
      'Taking GPS-tagged photos from the field',
      'Tagging photos by room and phase',
      'Scanning QR codes and barcodes',
      'Working offline — when the job site has no signal',
      'Installing UDGOK as a mobile app',
    ],
  },
  {
    title: 'Pay applications',
    icon: '💰',
    articles: [
      'Generating a draw from your schedule of values',
      'Sending a pay app to your client',
      'Tracking when your client opens + signs',
      'Marking a pay app as disputed',
      'Exporting pay app history for QuickBooks',
    ],
  },
  {
    title: 'Account & billing',
    icon: '⚙️',
    articles: [
      'Upgrading from Starter to Pro',
      'Adding or removing team members',
      'Updating your payment method',
      'Canceling your subscription',
      'Downloading an invoice or receipt',
    ],
  },
];

export default function HelpPage() {
  return (
    <MarketingPageShell>
      <MarketingNav />

      <section className="px-5 md:px-8 py-16 md:py-24">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Help center'}
          </div>
          <h1 className="font-black tracking-[-0.03em] text-5xl sm:text-6xl md:text-7xl leading-[0.95] mb-5">
            How can we <span className="font-serif italic text-orange-d">help?</span>
          </h1>
          <p className="text-ink-70 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            Browse the categories below or email us at{' '}
            <a href="mailto:support@udgok.com" className="text-orange-d underline">
              support@udgok.com
            </a>
            .
          </p>
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <input
                type="search"
                placeholder="Search articles…"
                className="w-full px-5 py-4 pl-12 bg-paper border-2 border-ink text-[15px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-ink-50">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 md:py-16 bg-paper border-t-2 border-ink">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {categories.map((cat) => (
              <div key={cat.title} className="bg-cream-2 border-2 border-line p-5 md:p-6 hover:border-ink transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{cat.icon}</span>
                  <h2 className="font-extrabold text-lg md:text-xl tracking-tight">{cat.title}</h2>
                </div>
                <ul className="space-y-2">
                  {cat.articles.map((a) => (
                    <li key={a}>
                      <a href="#" className="text-[13px] text-ink-70 hover:text-orange-d flex items-center gap-2 group">
                        <span className="text-ink-30 group-hover:text-orange-d">→</span>
                        <span className="group-hover:underline">{a}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-cream-2 border-2 border-ink p-6 md:p-8">
            <h2 className="font-black text-2xl md:text-3xl tracking-[-0.02em] mb-3">
              Still need <span className="font-serif italic text-orange-d">help?</span>
            </h2>
            <p className="text-ink-70 text-[15px] mb-6">
              We reply to every email. Average response time is under 4 hours during business days.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="mailto:support@udgok.com"
                className="px-5 py-3 bg-ink text-cream border-2 border-ink text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange hover:border-orange text-center"
              >
                Email support
              </a>
              <a
                href="mailto:hello@udgok.com"
                className="px-5 py-3 border-2 border-ink text-ink text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream text-center"
              >
                Sales / Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      <BottomCTA />
      <MarketingFooter />
    </MarketingPageShell>
  );
}
