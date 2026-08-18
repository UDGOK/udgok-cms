import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { BottomCTA } from '@/components/marketing/BottomCTA';

export const metadata = {
  title: 'About — UDGOK CMS',
  description: 'UDGOK CMS is built by construction people, for construction people. Here\'s the story.',
};

const values = [
  {
    icon: '🔨',
    title: 'Built for the field first',
    body: 'Every screen in UDGOK is built mobile-first. The foreman on site has the same tools as the PM in the office. No "this only works on desktop."',
  },
  {
    icon: '💸',
    title: 'Honest pricing',
    body: 'No hidden fees. No "contact us for a quote." No per-feature upsells. What you see is what you pay, forever.',
  },
  {
    icon: '🔓',
    title: 'Your data is yours',
    body: 'Export your full workspace as JSON, any time. Pro and Enterprise plans include one-click backup. We never hold your data hostage.',
  },
  {
    icon: '🚀',
    title: 'Ship fast, fix faster',
    body: 'We release weekly. If something is broken, you hear about it the same day and we have a fix within 48 hours.',
  },
];

export default function AboutPage() {
  return (
    <MarketingPageShell>
      <MarketingNav />

      <section className="px-5 md:px-8 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// About UDGOK'}
          </div>
          <h1 className="font-black tracking-[-0.03em] text-5xl sm:text-6xl md:text-7xl leading-[0.95] mb-6">
            Built by builders,<br />
            for <span className="font-serif italic text-orange-d">builders.</span>
          </h1>
          <p className="text-ink-70 text-lg md:text-xl max-w-2xl">
            UDGOK CMS started as a side project for a small construction company. It worked so well that other contractors asked to use it. Then it became a real product. Now it powers crews across the U.S.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 md:py-16 bg-paper border-t-2 border-ink">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {values.map((v) => (
              <div key={v.title} className="bg-cream-2 border-2 border-ink p-6 md:p-8">
                <div className="text-3xl mb-3">{v.icon}</div>
                <h3 className="font-extrabold text-xl mb-2 tracking-tight">{v.title}</h3>
                <p className="text-ink-70 text-[15px] leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-black text-3xl md:text-4xl tracking-[-0.02em] mb-6">
            The <span className="font-serif italic text-orange-d">team.</span>
          </h2>
          <div className="space-y-6 text-ink-70 text-base md:text-lg leading-relaxed">
            <p>
              UDGOK is a small team of contractors, designers, and engineers. Most of us have worked in the trades. We know what a 6am drywall delivery looks like. We know what &ldquo;this draw is overdue&rdquo; feels like. We built UDGOK because we needed it ourselves.
            </p>
            <p>
              We&apos;re based in the U.S. and we don&apos;t outsource support. When you email us, you get a real person who has touched the product &mdash; not a chatbot.
            </p>
          </div>
        </div>
      </section>

      <BottomCTA />
      <MarketingFooter />
    </MarketingPageShell>
  );
}
