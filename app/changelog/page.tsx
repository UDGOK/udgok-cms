import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { BottomCTA } from '@/components/marketing/BottomCTA';

export const metadata = {
  title: 'Changelog — UDGOK CMS',
  description: 'What\'s new in UDGOK CMS.',
};

const entries = [
  {
    date: 'Aug 17, 2026',
    version: 'v1.0',
    tag: 'GA',
    color: 'orange',
    items: [
      'PWA support — install UDGOK as a mobile app',
      'GPS-tagged photos from the field',
      'Barcode & QR code scanner',
      'Internal messages on projects, clients, and pay apps',
      'Offline drafts — keep working without signal',
      'Bottom sheet UI for mobile forms',
      'Master admin / platform owner system',
      'System health diagnostic page',
    ],
  },
  {
    date: 'Aug 14, 2026',
    version: 'v0.9',
    tag: 'Beta',
    color: 'ink',
    items: [
      'Subscription tiers (Starter / Pro / Enterprise)',
      'Workspace plan management for admins',
      'Activity log of all workspace events',
      'Backup & restore for Pro workspaces',
      'Public pay app redesign',
      'Documents page redesign',
    ],
  },
  {
    date: 'Aug 10, 2026',
    version: 'v0.8',
    tag: 'Beta',
    color: 'ink',
    items: [
      'Mobile responsive design with bottom tab bar',
      'Gantt chart for project schedules',
      'PDF download for pay applications',
      'CSI MasterFormat divisions',
      'Smart SOV templates',
    ],
  },
  {
    date: 'Aug 5, 2026',
    version: 'v0.7',
    tag: 'Alpha',
    color: 'ink',
    items: [
      'Pay app generation, sending, and tracking',
      'Schedule of values editor',
      'Subcontractor library with assignments',
      'Project teams and presence indicators',
    ],
  },
  {
    date: 'Jul 30, 2026',
    version: 'v0.6',
    tag: 'Alpha',
    color: 'ink',
    items: [
      'CRM: clients, properties, deals kanban',
      'Notes on every entity',
      'Dashboard with activity feed',
    ],
  },
  {
    date: 'Jul 22, 2026',
    version: 'v0.5',
    tag: 'Alpha',
    color: 'ink',
    items: [
      'Auth via Clerk',
      'Workspaces with members + roles',
      'Onboarding flow',
      'Design system (UDGOK Bold)',
    ],
  },
];

const tagColor = {
  orange: 'bg-orange text-paper',
  ink: 'bg-ink text-cream',
} as const;

export default function ChangelogPage() {
  return (
    <MarketingPageShell>
      <MarketingNav />

      <section className="px-5 md:px-8 py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// Changelog'}
          </div>
          <h1 className="font-black tracking-[-0.03em] text-5xl sm:text-6xl md:text-7xl leading-[0.95] mb-5">
            What&apos;s <span className="font-serif italic text-orange-d">new.</span>
          </h1>
          <p className="text-ink-70 text-lg md:text-xl">
            We ship weekly. Newest first. Subscribe by email or RSS.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 pb-12 md:pb-20">
        <div className="max-w-3xl mx-auto space-y-6">
          {entries.map((e) => (
            <div key={e.version} className="bg-paper border-2 border-ink">
              <div className="px-5 py-4 md:px-7 md:py-5 border-b-2 border-line flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-0.5">
                    {e.date}
                  </div>
                  <div className="font-black text-xl tracking-tight">{e.version}</div>
                </div>
                <div className={`px-3 py-1 text-[10px] font-mono font-extrabold uppercase tracking-[0.15em] ${tagColor[e.color as keyof typeof tagColor]}`}>
                  {e.tag}
                </div>
              </div>
              <ul className="px-5 py-5 md:px-7 md:py-6 space-y-2.5">
                {e.items.map((item, i) => (
                  <li key={i} className="text-[14px] text-ink-70 flex items-start gap-3">
                    <span className="text-orange-d font-black flex-shrink-0 mt-0.5">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="text-center pt-4">
            <a
              href="/changelog.xml"
              className="text-[12px] font-mono uppercase tracking-[0.15em] text-ink-50 hover:text-ink underline"
            >
              RSS feed →
            </a>
          </div>
        </div>
      </section>

      <BottomCTA />
      <MarketingFooter />
    </MarketingPageShell>
  );
}
