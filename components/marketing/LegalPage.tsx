import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { BottomCTA } from '@/components/marketing/BottomCTA';

export function LegalPage({
  title,
  eyebrow,
  subtitle,
  lastUpdated,
  sections,
}: {
  title: string;
  eyebrow: string;
  subtitle: string;
  lastUpdated: string;
  sections: { heading: string; body: string | string[] }[];
}) {
  return (
    <MarketingPageShell>
      <MarketingNav />

      <section className="px-5 md:px-8 py-12 md:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {eyebrow}
          </div>
          <h1 className="font-black tracking-[-0.03em] text-4xl md:text-5xl leading-[1.05] mb-4">
            {title}
          </h1>
          <p className="text-ink-70 text-base md:text-lg mb-2">{subtitle}</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 pb-12 md:pb-20">
        <div className="max-w-3xl mx-auto space-y-8">
          {sections.map((s, i) => (
            <div key={i} className="bg-paper border-2 border-line p-5 md:p-7">
              <h2 className="font-extrabold text-lg md:text-xl tracking-tight mb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-orange-d mr-2">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.heading}
              </h2>
              {Array.isArray(s.body) ? (
                <div className="space-y-3 text-ink-70 text-[14px] md:text-[15px] leading-relaxed">
                  {s.body.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              ) : (
                <p className="text-ink-70 text-[14px] md:text-[15px] leading-relaxed">{s.body}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <BottomCTA />
      <MarketingFooter />
    </MarketingPageShell>
  );
}
