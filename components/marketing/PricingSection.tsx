import Link from 'next/link';

export interface PlanData {
  name: string;
  price: string;
  per: string;
  tagline: string;
  features: { label: string; included: boolean }[];
  cta: { label: string; href: string };
  featured: boolean;
  badge?: string;
}

export function PricingSection({ plans }: { plans: PlanData[] }) {
  return (
    <section id="pricing" className="px-5 md:px-8 py-20 md:py-28 bg-cream">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Pricing'}
          </div>
          <h2 className="font-black tracking-[-0.02em] text-4xl sm:text-5xl md:text-6xl leading-[1.05]">
            Pick your <span className="font-serif italic text-orange-d">crew size.</span>
          </h2>
          <p className="text-ink-70 text-base md:text-lg mt-4">
            No hidden fees. Cancel any time. Save 20% on annual plans.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {plans.map((p) => (
            <PricingCard key={p.name} plan={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingCard({ plan }: { plan: PlanData }) {
  return (
    <div
      className={`relative bg-paper border-2 border-ink p-6 md:p-7 transition-transform ${
        plan.featured ? 'md:-translate-y-3 ring-1 ring-orange' : 'hover:-translate-y-1'
      }`}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange text-paper px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em]">
          {plan.badge}
        </span>
      ) : null}

      <div className="text-[12px] font-mono uppercase tracking-[0.15em] font-extrabold mb-3">
        {plan.name}
      </div>
      <div className="font-black text-4xl md:text-5xl tracking-[-0.02em] mb-1">
        {plan.price}
        {plan.per ? (
          <span className="text-base font-extrabold text-ink-50 ml-1">{plan.per}</span>
        ) : null}
      </div>
      <p className="text-[12px] text-ink-70 mb-5 min-h-[36px]">{plan.tagline}</p>

      <ul className="space-y-1.5 mb-6 pb-5 border-b border-line-soft">
        {plan.features.map((f) => (
          <li
            key={f.label}
            className={`text-[12px] flex items-start gap-2 ${f.included ? '' : 'text-ink-30 line-through'}`}
          >
            <span
              className={`flex-shrink-0 w-4 h-4 flex items-center justify-center text-[10px] font-black ${
                f.included ? 'bg-orange text-paper' : 'text-ink-30'
              }`}
            >
              {f.included ? '✓' : '–'}
            </span>
            {f.label}
          </li>
        ))}
      </ul>

      <Link
        href={plan.cta.href}
        className={`block text-center px-4 py-3 border-2 text-[12px] font-extrabold uppercase tracking-[0.15em] transition-colors ${
          plan.featured
            ? 'bg-orange text-paper border-orange hover:bg-orange-d hover:border-orange-d'
            : 'bg-ink text-cream border-ink hover:bg-orange hover:border-orange'
        }`}
      >
        {plan.cta.label}
      </Link>
    </div>
  );
}
