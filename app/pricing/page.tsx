import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { PricingSection } from '@/components/marketing/PricingSection';
import { BottomCTA } from '@/components/marketing/BottomCTA';
import { getMarketingData } from '@/lib/marketing/queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing — UDGOK CMS',
  description: 'Simple, honest pricing. Free forever for solo crews. Pro for active contractors. Enterprise for multi-crew builders.',
};

export default async function PricingPage() {
  const { userId } = await auth();
  if (userId) {
    const membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { workspace: { select: { slug: true } } },
    });
    if (membership) {
      redirect(`/w/${membership.workspace.slug}/dashboard`);
    }
    redirect('/workspaces');
  }

  const data = await getMarketingData();

  return (
    <MarketingPageShell>
      <MarketingNav />

      <PricingSection plans={data.plans} />

      <FAQ />

      <BottomCTA />

      <MarketingFooter />
    </MarketingPageShell>
  );
}

function FAQ() {
  const faqs = [
    {
      q: 'Is the Starter plan really free forever?',
      a: 'Yes. No credit card, no time limit, no "free trial" tricks. The Starter plan includes everything a small crew needs to manage clients, projects, and pay apps. You only pay when you upgrade to Pro for GPS photos, barcode scanning, and export.',
    },
    {
      q: 'What\'s the difference between monthly and annual?',
      a: 'Annual plans save 20%. So Pro is $39/user/mo billed annually vs $49/user/mo billed monthly. The features are exactly the same.',
    },
    {
      q: 'Can I switch plans later?',
      a: 'Yes. Upgrade or downgrade at any time. If you upgrade, you get the new features immediately and we prorate the difference. If you downgrade, you keep Pro features until the end of your billing period.',
    },
    {
      q: 'How does per-user pricing work?',
      a: 'You only pay for active users. If a crew member is on leave, mark them inactive in your team settings and they won\'t be billed. SSO seats and admin seats are separate in Enterprise.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'Credit card (Visa, MC, Amex), ACH transfer, and wire for Enterprise. All payments are processed through Stripe — your card never touches our servers.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes. No contracts, no cancellation fees. Cancel from your workspace settings and you\'ll keep paid features until the end of your billing period, then automatically drop to the Starter plan.',
    },
    {
      q: 'Do you offer a free trial of Pro?',
      a: 'Yes — 14 days, no credit card required. You can also reach out for an extended trial if you\'re evaluating for a larger team.',
    },
    {
      q: 'Is my data portable?',
      a: 'Yes. Pro and Enterprise plans include full export of your workspace as JSON. You can import the same JSON into a new workspace or back into your own database. Your data is yours.',
    },
  ];

  return (
    <section className="px-5 md:px-8 py-20 md:py-28 bg-paper">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Frequently asked'}
          </div>
          <h2 className="font-black tracking-[-0.02em] text-4xl md:text-5xl leading-[1.05]">
            Questions, <span className="font-serif italic text-orange-d">answered.</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group bg-cream-2 border-2 border-line open:border-ink transition-colors"
            >
              <summary className="cursor-pointer p-5 flex items-center justify-between gap-4 font-extrabold text-[15px] md:text-base list-none">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{f.q}</span>
                </span>
                <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-paper border border-line group-open:border-ink group-open:bg-ink group-open:text-cream text-lg font-light transition-all">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 -mt-2 text-[14px] text-ink-70 leading-relaxed pl-12">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
