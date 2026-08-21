import Link from 'next/link';

export function BottomCTA() {
  return (
    <section className="bg-ink text-cream border-t-2 border-ink">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20 md:py-28 text-center">
        <h2 className="font-black tracking-[-0.02em] text-4xl sm:text-5xl md:text-7xl leading-[1.05] mb-5">
          Stop managing <span className="font-serif italic text-orange">jobs</span>
          <br className="hidden md:block" /> in your <span className="font-serif italic text-orange">inbox.</span>
        </h2>
        <p className="text-cream/70 text-base md:text-lg mb-8 max-w-xl mx-auto">
          14 days free. No credit card. Cancel any time. Your crew will thank you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sign-up"
            className="px-6 py-4 bg-orange text-paper border-2 border-orange text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d hover:border-orange-d"
          >
            Start free →
          </Link>
          <Link
            href="/features"
            className="px-6 py-4 border-2 border-cream/30 text-cream text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-cream/10"
          >
            See what you get →
          </Link>
        </div>
      </div>
    </section>
  );
}
