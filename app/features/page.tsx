import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { BottomCTA } from '@/components/marketing/BottomCTA';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Features — UDGOK CMS',
  description: 'Every tool a builder needs in one place. CRM, projects, pay apps, photos, tasks, and team — all built mobile-first.',
};

interface Feature {
  id: string;
  title: string;
  tagline: string;
  desc: string;
  bullets: string[];
  tag?: string;
  icon: string;
  accent?: boolean;
}

const features: Feature[] = [
  {
    id: 'crm',
    title: 'CRM + Deals',
    tagline: 'Every lead, every touch.',
    desc: 'Track every lead from first call to signed contract. Kanban-style deal pipeline, contact history, and notes — never lose a prospect again.',
    bullets: [
      'Visual deal board with drag-drop stages',
      'Auto-captured contact history',
      'Note timeline per client',
      'Link deals to projects on close',
    ],
    icon: '📋',
  },
  {
    id: 'projects',
    title: 'Project Tracking',
    tagline: 'Gantt + Schedule of Values.',
    desc: 'Week-aligned Gantt timelines, schedules of values, and progress dashboards. Every project, every division, every dollar.',
    bullets: [
      'Gantt chart with project span row',
      'Smart SOV with CSI MasterFormat',
      'Auto-calculated % complete',
      'Today marker on every timeline',
    ],
    icon: '📅',
  },
  {
    id: 'pay-apps',
    title: 'Pay Applications',
    tagline: 'One click to get paid.',
    desc: 'Generate a draw request from your SOV in one click. Send via email with a public view link. Track when clients open and sign.',
    bullets: [
      'Auto-cumulative math (no errors)',
      'Public view link with tracking',
      'Native PDF download for printing',
      'Acknowledge + dispute flow',
    ],
    icon: '💰',
  },
  {
    id: 'photos',
    title: 'GPS Site Photos',
    tagline: 'Tag the room. Snap. Done.',
    desc: 'Foremen snap a photo, pick the room and phase, and it\'s filed with GPS coordinates. No more texting pictures to the office.',
    bullets: [
      'Native camera, auto GPS at the shot',
      'Rough-in (yellow) vs Final (green)',
      'Filter by room, area, or phase',
      'Lightbox with full metadata',
    ],
    icon: '📸',
    tag: 'Pro',
    accent: true,
  },
  {
    id: 'scan',
    title: 'Barcode & QR Scan',
    tagline: 'Find anything in seconds.',
    desc: 'Scan equipment, materials, or subcontractor badges. The foreman\'s phone becomes a warehouse scanner — find anything in the workspace instantly.',
    bullets: [
      'Big FAB button in mobile tab bar',
      'Workspace lookup on every scan',
      'QR + 1D barcodes supported',
      'Camera permission handled gracefully',
    ],
    icon: '📊',
    tag: 'Pro',
  },
  {
    id: 'presence',
    title: 'Team Presence',
    tagline: 'See your crew without meetings.',
    desc: 'Green dots show who\'s online right now. See your crew without scheduling a meeting. Heartbeat-based, no WebSockets needed.',
    bullets: [
      'Online / idle / offline status',
      'Avatars on the topbar',
      'Live workspace dashboard',
      'Last-seen timestamps',
    ],
    icon: '👥',
  },
  {
    id: 'messages',
    title: 'Internal Messages',
    tagline: 'Per-entity threads, never lost.',
    desc: 'Per-entity comment threads on every project, client, deal, and sub. No more lost context in group texts. Replies, edits, and read tracking.',
    bullets: [
      'Threaded replies',
      'Author can edit/delete own',
      'Admins can delete any',
      'Activity-logged',
    ],
    icon: '💬',
  },
  {
    id: 'pwa',
    title: 'PWA + Offline',
    tagline: 'Native app, no app store.',
    desc: 'Install as a native app on any phone. Form drafts persist offline and sync when you reconnect. Yellow banner tells you when you\'re offline.',
    bullets: [
      'One-tap install (no app store)',
      'Auto-save drafts in localStorage',
      'Service worker for fast loads',
      'iOS home-screen ready',
    ],
    icon: '📱',
  },
  {
    id: 'subcontractors',
    title: 'Subcontractor Library',
    tagline: 'A vendor list that learns.',
    desc: 'Maintain a library of every sub you\'ve ever worked with. Tag them by trade, assign them to divisions, track contract amounts. Re-hire your best subs in one click.',
    bullets: [
      'Library + assignments, not contacts',
      'Contract amounts per project',
      'Status tracking (proposed → contracted → active)',
      'Division-level assignments',
    ],
    icon: '🔨',
  },
  {
    id: 'tasks',
    title: 'Task Board',
    tagline: 'Five columns, zero meetings.',
    desc: 'Kanban-style task board with five columns. Assign to team members, set due dates, see what\'s open across every project at a glance.',
    bullets: [
      '5-column kanban (todo → done)',
      'Per-workspace + per-project tasks',
      'Assignee + due date tracking',
      'Drag-and-drop status updates',
    ],
    icon: '✅',
  },
  {
    id: 'files',
    title: 'Files & Documents',
    tagline: 'Vercel Blob, organized.',
    desc: 'Upload files to Vercel Blob with automatic categorization. Brochures, marketing, contracts, site photos, submittals — all in one searchable library.',
    bullets: [
      '9 built-in categories',
      'Search by name + uploader',
      'Mobile-friendly upload',
      'GPS-tagged photo support',
    ],
    icon: '📁',
  },
  {
    id: 'admin',
    title: 'Master Admin Tools',
    tagline: 'For platform owners.',
    desc: 'Built-in admin dashboard for the platform owner. Set workspace plans, force-add members, monitor system health, and send test emails.',
    bullets: [
      'Bypass all plan gates',
      'Change any workspace\'s plan',
      'Force-add any user anywhere',
      'Live system health diagnostic',
    ],
    icon: '👑',
  },
];

export default async function FeaturesPage() {
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

  return (
    <MarketingPageShell>
      <MarketingNav />

      <Header />

      <div className="bg-cream-2 border-y-2 border-ink py-3 sticky top-[60px] md:top-[68px] z-30">
        <div className="max-w-7xl mx-auto px-5 md:px-8 flex gap-2 overflow-x-auto no-scrollbar">
          {features.map((f) => (
            <a
              key={f.id}
              href={`#${f.id}`}
              className="px-3 py-1.5 bg-paper border-2 border-line text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-50 hover:border-ink hover:text-ink whitespace-nowrap flex-shrink-0"
            >
              {f.icon} {f.title.split(' ')[0]}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-16 space-y-12 md:space-y-16">
        {features.map((f, i) => (
          <section
            key={f.id}
            id={f.id}
            className={`scroll-mt-32 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 md:gap-10 ${
              i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''
            }`}
          >
            <div className="md:sticky md:top-32 md:self-start">
              <div className={`w-12 h-12 flex items-center justify-center text-2xl mb-3 ${f.accent ? 'bg-orange text-paper' : 'bg-ink text-cream'}`}>
                {f.icon}
              </div>
              <h2 className="font-black text-2xl md:text-3xl tracking-[-0.02em] leading-tight mb-2">
                {f.title}
                {f.tag ? (
                  <span className="ml-2 px-2 py-0.5 bg-orange text-paper text-[9px] font-extrabold uppercase tracking-[0.1em] align-middle">
                    {f.tag}
                  </span>
                ) : null}
              </h2>
              <p className="font-serif italic text-orange-d text-lg">
                {f.tagline}
              </p>
            </div>
            <div>
              <p className="text-ink-70 text-base md:text-lg mb-5 leading-relaxed">
                {f.desc}
              </p>
              <ul className="space-y-2.5">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px]">
                    <span className="w-5 h-5 flex-shrink-0 bg-orange text-paper flex items-center justify-center text-[11px] font-black">
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <BottomCTA />

      <MarketingFooter />
    </MarketingPageShell>
  );
}

function Header() {
  return (
    <section className="px-5 md:px-8 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
          {'// Features'}
        </div>
        <h1 className="font-black tracking-[-0.03em] text-5xl sm:text-6xl md:text-7xl leading-[0.95] mb-5">
          Every <span className="font-serif italic text-orange-d">tool</span> a builder needs.
        </h1>
        <p className="text-ink-70 text-lg md:text-xl max-w-2xl mb-8">
          Built mobile-first, designed for the field, polished for the office. Below is the full tour of every feature in UDGOK CMS.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/sign-up"
            className="px-5 py-3.5 bg-orange text-paper border-2 border-orange text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d hover:border-orange-d text-center"
          >
            Start free →
          </Link>
          <Link
            href="/pricing"
            className="px-5 py-3.5 border-2 border-ink text-ink text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream text-center"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
