import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { PricingSection } from '@/components/marketing/PricingSection';
import { TestimonialsBlock } from '@/components/marketing/TestimonialsBlock';
import { BottomCTA } from '@/components/marketing/BottomCTA';
import { getMarketingData } from '@/lib/marketing/queries';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // If signed in, send to the user's primary workspace
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
      <MarketingNav signedIn={false} />

      <Hero />

      <LogoStrip />

      <Features />

      <BigFeature1 />

      <BigFeature2 />

      <BigFeature3 />

      <PricingSection plans={data.plans} />

      <TestimonialsBlock />

      <BottomCTA />

      <MarketingFooter />
    </MarketingPageShell>
  );
}

function Hero() {
  return (
    <section className="px-5 md:px-8 pt-10 md:pt-16 pb-12 md:pb-20 relative overflow-hidden">
      <div
        aria-hidden
        className="hidden lg:block absolute top-20 right-0 w-[400px] h-[400px] bg-orange/5 rounded-full blur-3xl -z-0"
      />

      <div className="max-w-7xl mx-auto relative">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-12 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-ink text-cream font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 bg-orange rounded-full" />
              Construction management, built for builders
            </div>

            <h1 className="font-black tracking-[-0.03em] mt-5 md:mt-6 mb-5 md:mb-6 text-[44px] sm:text-6xl md:text-7xl lg:text-[80px] leading-[0.95]">
              Run your <span className="font-serif italic text-orange">jobs.</span>
              <br />
              Not your <span className="font-serif italic text-orange">spreadsheets.</span>
            </h1>

            <p className="text-[16px] md:text-xl text-ink-70 max-w-[560px] mb-6 md:mb-8 leading-relaxed">
              The construction management CMS that handles clients, projects, pay apps, photos, and your entire team — from the field to the office.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6 md:mb-8">
              <Link
                href="/sign-up"
                className="px-5 py-3.5 md:py-4 bg-orange text-paper border-2 border-orange text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d hover:border-orange-d text-center"
              >
                Start free →
              </Link>
              <Link
                href="/showcase"
                className="px-5 py-3.5 md:py-4 border-2 border-ink text-ink text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream text-center"
              >
                See how it works
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-50 font-mono uppercase tracking-[0.1em]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-success rounded-full" />
                Free forever
              </span>
              <span>No credit card</span>
              <span>5-min setup</span>
            </div>
          </div>

          <div className="relative z-10">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -top-3 -left-3 md:-top-4 md:-left-4 z-20 bg-orange text-paper px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] shadow-[4px_4px_0_var(--ink)]">
        ● Live
      </div>

      <div className="bg-paper border-2 border-ink shadow-[10px_10px_0_var(--ink)] md:shadow-[14px_14px_0_var(--ink)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line-soft bg-cream-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning" />
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="font-extrabold text-[10px] uppercase tracking-[0.1em] ml-2 truncate">
            Dashboard — Coldstone Renovation
          </span>
        </div>

        <div className="p-4 md:p-5">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <PreviewTile label="Active jobs" value="2" />
            <PreviewTile label="Billed MTD" value="$12.5K" highlight />
            <PreviewTile label="Open tasks" value="6" />
            <PreviewTile label="On-site" value="3" highlight />
          </div>

          <div className="border-t border-line-soft pt-2">
            <PreviewRow
              name="Pay app #1 — Coldstone"
              status="Sent"
              statusClass="bg-orange text-paper"
            />
            <PreviewRow
              name="Sub agreement — Acme"
              status="Active"
              statusClass="bg-ink text-cream"
            />
            <PreviewRow
              name="Rough-in photos — Master bath"
              status="Filed"
              statusClass="bg-success text-paper"
            />
            <PreviewRow
              name="Materials delivery — lumber"
              status="Today"
              statusClass="bg-cream-2 text-ink"
            />
          </div>
        </div>
      </div>

      <div className="absolute -bottom-3 -right-3 md:-bottom-4 md:-right-4 z-20 bg-ink text-cream px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] shadow-[4px_4px_0_var(--orange)]">
        $0 to start
      </div>
    </div>
  );
}

function PreviewTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-2.5 md:p-3 bg-cream border border-line">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-50">{label}</div>
      <div className={`font-black text-xl md:text-2xl mt-0.5 ${highlight ? 'text-orange' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function PreviewRow({ name, status, statusClass }: { name: string; status: string; statusClass: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-line-soft last:border-b-0">
      <span className="text-[12px] font-bold flex-1 truncate">{name}</span>
      <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${statusClass}`}>
        {status}
      </span>
    </div>
  );
}

function LogoStrip() {
  const marks = ['Riverside', 'Field & Co.', 'Meridian', 'Blackwater', 'Summit', 'Oak + Iron'];
  return (
    <div className="border-y-2 border-ink bg-paper py-8 md:py-10">
      <div className="max-w-7xl mx-auto px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
        <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-ink-50 font-bold">
          Built for crews like
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {marks.map((m) => (
            <span
              key={m}
              className="font-black text-[15px] md:text-base text-ink-50 tracking-tight opacity-60"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Features() {
  const features = [
    { icon: '📋', title: 'CRM + Deals', desc: 'Track every lead from first call to signed contract. Kanban-style deal pipeline, contact history, and notes.', tag: null },
    { icon: '📅', title: 'Project Tracking', desc: 'Gantt timelines, schedules of values, and progress dashboards. Always know where every job stands.', tag: null },
    { icon: '💰', title: 'Pay Applications', desc: 'Generate, send, and track draw requests. Clients view and sign from a public link.', tag: null },
    { icon: '📸', title: 'GPS Site Photos', desc: 'Foremen snap rough-in and final photos from the field, GPS-tagged and room-categorized.', tag: 'Pro' },
    { icon: '📊', title: 'Barcode & QR Scan', desc: 'Scan equipment, materials, and badges. Find anything in seconds from your phone.', tag: 'Pro' },
    { icon: '👥', title: 'Team Presence', desc: 'See who\'s online right now with real-time green dots on every crew member.', tag: null },
    { icon: '💬', title: 'Internal Messages', desc: 'Per-entity comment threads on every project, client, and deal. With replies, edits, and tracking.', tag: null },
    { icon: '📱', title: 'PWA + Offline', desc: 'Install as a native app on any phone. Form drafts persist offline and sync when you reconnect.', tag: null },
    { icon: '🔄', title: 'Backup & Restore', desc: 'Export and import your full workspace as JSON. Your data stays portable.', tag: 'Pro' },
  ];

  return (
    <section id="features" className="px-5 md:px-8 py-20 md:py-28 bg-paper">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// What you get'}
          </div>
          <h2 className="font-black tracking-[-0.02em] text-4xl sm:text-5xl md:text-6xl leading-[1.05]">
            Every <span className="font-serif italic text-orange-d">tool</span> a builder needs.
          </h2>
          <p className="text-ink-70 text-base md:text-lg mt-4">
            Stop paying for 5 different apps. UDGOK gives you CRM, project tracking, pay apps, photos, tasks, and team — all in one.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-2 border-ink">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`relative p-5 md:p-7 ${i < features.length - 1 ? 'border-b sm:border-b-0' : ''} ${
                (i + 1) % 3 !== 0 ? 'sm:border-r-0 lg:border-r' : ''
              } ${i < features.length - 3 ? 'lg:border-b' : ''} border-line hover:bg-cream-2/40 transition-colors`}
            >
              {f.tag ? (
                <span className="absolute top-4 right-4 md:top-5 md:right-5 px-2 py-0.5 bg-orange text-paper text-[9px] font-extrabold uppercase tracking-[0.1em]">
                  {f.tag}
                </span>
              ) : null}
              <div
                className={`w-11 h-11 md:w-12 md:h-12 flex items-center justify-center text-xl mb-4 ${
                  f.tag ? 'bg-orange text-paper' : 'bg-ink text-cream'
                }`}
              >
                {f.icon}
              </div>
              <h3 className="font-extrabold text-base md:text-lg mb-2 tracking-tight">
                {f.title}
              </h3>
              <p className="text-[13px] md:text-sm text-ink-70 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BigFeature1() {
  return (
    <section className="px-5 md:px-8 py-20 md:py-28 bg-cream">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Foremen love it'}
          </div>
          <h2 className="font-black tracking-[-0.02em] text-4xl md:text-5xl leading-[1.05] mb-5">
            Snap a <span className="font-serif italic text-orange-d">photo</span>,<br />
            tag the <span className="font-serif italic text-orange-d">room</span>. Done.
          </h2>
          <p className="text-ink-70 text-base md:text-lg mb-6 leading-relaxed">
            No more texting photos to the office. No more &ldquo;where&apos;s the master bath rough-in?&rdquo; Open the app, take a pic, pick &ldquo;Rough-in&rdquo; and &ldquo;Master Bath&rdquo; — it&apos;s in the project, GPS-tagged, before you walk back to the truck.
          </p>
          <ul className="space-y-2.5">
            {[
              'Native camera, works offline',
              'GPS auto-captured at the moment of the shot',
              'Color-coded rough-in (yellow) vs final (green)',
              'Filter by room, area, or phase in the gallery',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px]">
                <span className="w-5 h-5 flex-shrink-0 bg-orange text-paper flex items-center justify-center text-[11px] font-black">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-paper border-2 border-ink p-5 md:p-6 shadow-[8px_8px_0_var(--ink)]">
          <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-50 mb-3">
            Photos — Coldstone
          </div>
          {[
            { phase: 'Rough', label: 'Master Bath — plumbing', color: 'bg-warning text-ink' },
            { phase: 'Rough', label: 'Kitchen — electrical', color: 'bg-warning text-ink' },
            { phase: 'Final', label: 'Living room — paint', color: 'bg-success text-paper' },
            { phase: 'Rough', label: 'Master Bath — framing', color: 'bg-warning text-ink' },
            { phase: 'Final', label: 'Kitchen — tile', color: 'bg-success text-paper' },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-line-soft last:border-b-0 font-mono text-[11px]">
              <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] ${row.color}`}>
                {row.phase}
              </span>
              <span className="flex-1">{row.label}</span>
              <span className="text-ink-30 text-[9px]">📍 36.154</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BigFeature2() {
  return (
    <section className="px-5 md:px-8 py-20 md:py-28 bg-paper">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="order-2 lg:order-1 bg-cream border-2 border-ink p-5 md:p-6 shadow-[8px_8px_0_var(--orange)]">
          <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-50 mb-3">
            Pay app #1 — Coldstone
          </div>
          <div className="space-y-2 font-mono text-[12px]">
            <div className="flex justify-between py-1.5 border-b border-line">
              <span>Total contract</span>
              <span className="font-extrabold">$125,000</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line">
              <span>Previous draws</span>
              <span>$0</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line text-orange">
              <span className="font-extrabold">This draw</span>
              <span className="font-extrabold">$12,500</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-ink font-extrabold">
              <span>Balance</span>
              <span>$112,500</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-line-soft flex items-center gap-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 bg-orange text-paper text-[9px] font-extrabold uppercase tracking-[0.05em]">Sent</span>
            <span className="text-ink-50">Nov 17</span>
            <span className="px-2 py-0.5 bg-success text-paper text-[9px] font-extrabold uppercase tracking-[0.05em]">Viewed</span>
            <span className="text-ink-50">Nov 18</span>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Office loves it more'}
          </div>
          <h2 className="font-black tracking-[-0.02em] text-4xl md:text-5xl leading-[1.05] mb-5">
            Generate, send,<br />
            <span className="font-serif italic text-orange-d">get paid.</span>
          </h2>
          <p className="text-ink-70 text-base md:text-lg mb-6 leading-relaxed">
            One click generates a pay app PDF from your schedule of values. Send via email with a public view link. Track when your client opens it, when they sign, and when the ACH hits. All without leaving UDGOK.
          </p>
          <ul className="space-y-2.5">
            {[
              'Auto-cumulative math (no calculator errors)',
              'Public view link with view tracking',
              'Native PDF download for printing',
              'CSV export for QuickBooks',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px]">
                <span className="w-5 h-5 flex-shrink-0 bg-orange text-paper flex items-center justify-center text-[11px] font-black">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function BigFeature3() {
  return (
    <section className="px-5 md:px-8 py-20 md:py-28 bg-cream">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// One app, every job'}
          </div>
          <h2 className="font-black tracking-[-0.02em] text-4xl md:text-5xl leading-[1.05] mb-5">
            <span className="font-serif italic text-orange-d">PWA</span> + offline.
            <br />
            Install like a native app.
          </h2>
          <p className="text-ink-70 text-base md:text-lg mb-6 leading-relaxed">
            Add UDGOK to your foreman&apos;s home screen with one tap. The app works offline — form drafts persist in localStorage and sync when you reconnect. Yellow banner tells them when they&apos;re offline.
          </p>
          <ul className="space-y-2.5">
            {[
              'One-tap install on iOS and Android',
              'No app store, no approval process',
              'Form drafts auto-save as you type',
              'Service worker caches the app shell',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px]">
                <span className="w-5 h-5 flex-shrink-0 bg-orange text-paper flex items-center justify-center text-[11px] font-black">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-paper border-2 border-ink p-5 md:p-6 shadow-[8px_8px_0_var(--ink)] flex justify-center">
          <div className="bg-ink rounded-[36px] p-3 max-w-[280px] w-full shadow-[8px_8px_0_var(--orange)]">
            <div className="bg-cream rounded-[24px] p-4">
              <div className="flex justify-between font-mono text-[10px] mb-3">
                <span>9:41</span>
                <span>📶 4G</span>
              </div>
              <div className="font-extrabold text-[15px] mb-2">Snap &amp; tag</div>
              <div className="bg-gradient-to-br from-terracotta to-ochre rounded-xl h-20 flex items-center justify-center text-paper text-2xl mb-2">🏠</div>
              <div className="bg-paper rounded-lg p-2 font-mono text-[10px] space-y-1">
                <div className="flex justify-between py-0.5 border-b border-line-soft">
                  <span>Phase</span>
                  <span className="text-rust font-extrabold">ROUGH-IN</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-line-soft">
                  <span>Room</span>
                  <span>Master Bath</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Area</span>
                  <span>Floor 1</span>
                </div>
              </div>
              <div className="bg-rust text-paper text-center py-2 rounded-lg font-extrabold text-[11px] mt-2">
                Save photo
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
