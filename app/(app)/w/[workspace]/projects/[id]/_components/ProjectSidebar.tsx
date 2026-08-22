'use client';

/**
 * ProjectSidebar — the vertical grouped navigation for a single
 * project. Replaces the old horizontal tab bar.
 *
 *   ┌───────────────────────┐
 *   │ // Working            │
 *   │  ▸ Overview            │
 *   │  ▸ AI board       [2]  │
 *   │  ▸ Photos       [87]  │
 *   │  ▸ Tasks         [3]!  │   ← red = danger, warning = yellow
 *   │  ▸ Team          [4]   │
 *   │                        │
 *   │ // Schedule            │
 *   │  ▸ Schedule            │
 *   │  ▸ Takeoff             │
 *   │  ▸ Map                 │
 *   │                        │
 *   │ // Money               │
 *   │  ▸ Pay apps    [$45k]  │
 *   │  ▸ Financials          │
 *   │  ▸ Subs                │
 *   │  ▸ Inventory           │
 *   │                        │
 *   │ // Site                │
 *   │  ▸ Check-in    ● 5     │   ← hot = orange dot
 *   │  ▸ Permits             │
 *   └───────────────────────┘
 *
 * Mobile: rendered as a slide-in drawer triggered by a hamburger
 * in the page header (handled by the parent layout).
 *
 * The active state is derived from the current URL pathname +
 * search params — pure client-side, no server round-trip.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  SIDEBAR_GROUPS,
  hrefForItem,
  type SidebarBadge,
} from '@/lib/projects/sidebar-status';

interface Props {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  projectCode?: string | null;
  badges: Record<string, SidebarBadge | undefined>;
  /** When true, render the desktop fixed rail. When false, render the mobile drawer. */
  variant: 'desktop' | 'mobile';
  /** For mobile: whether the drawer is open */
  open?: boolean;
  /** For mobile: close callback */
  onClose?: () => void;
}

export function ProjectSidebar({
  workspaceSlug,
  projectId,
  projectName,
  projectCode,
  badges,
  variant,
  open = false,
  onClose,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Lock body scroll when the mobile drawer is open.
  useEffect(() => {
    if (variant !== 'mobile' || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [variant, open]);

  // Close the mobile drawer on route change.
  useEffect(() => {
    if (variant === 'mobile' && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <>
      {/* Mobile-only scrim */}
      {variant === 'mobile' ? (
        <div
          onClick={onClose}
          className={`fixed inset-0 bg-ink/40 z-40 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={
          variant === 'desktop'
            ? // Desktop: fixed left rail, always visible at md+
              'hidden md:flex flex-col w-60 lg:w-64 flex-shrink-0 border-r border-line bg-cream h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto'
            : // Mobile: drawer that slides in from the left
              `fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-cream border-r-2 border-ink transform transition-transform duration-200 ease-out ${
                open ? 'translate-x-0' : '-translate-x-full'
              } overflow-y-auto md:hidden`
        }
        aria-label="Project navigation"
      >
        {/* Project name header */}
        <div className="px-4 py-4 border-b-2 border-ink bg-paper sticky top-0 z-10">
          <div className="label-mono">{projectCode ?? 'PROJECT'}</div>
          <div className="font-black text-[15px] leading-tight mt-0.5 truncate">
            {projectName}
          </div>
        </div>

        <nav className="py-3">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.key} className="mb-3">
              <div className="px-4 py-1.5">
                <div className="label-mono">{'// '}{group.label}</div>
              </div>
              <ul>
                {group.items.map((item) => {
                  const href = hrefForItem(item, workspaceSlug, projectId);
                  const badge = badges[item.key];
                  const active = isActive(pathname, searchParams, href, item.key);
                  return (
                    <li key={item.key}>
                      <SidebarLink
                        href={href}
                        label={item.label}
                        badge={badge}
                        active={active}
                        iconKey={item.key}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom helper — return to workspace */}
        <div className="px-4 py-3 border-t border-line-soft">
          <Link
            href={`/w/${workspaceSlug}/projects`}
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink flex items-center gap-1"
          >
            <span aria-hidden>←</span> All projects
          </Link>
        </div>
      </aside>
    </>
  );
}

// =====================================================================
// Helpers
// =====================================================================

function isActive(
  pathname: string,
  searchParams: URLSearchParams,
  itemHref: string,
  itemKey: string,
): boolean {
  // Parse itemHref into path + query
  const [itemPath, itemQuery] = itemHref.split('?');
  const itemParams = new URLSearchParams(itemQuery ?? '');

  // For overview (no query), active when no ?tab= is in current URL
  // and we're on the project base.
  if (!itemQuery) {
    return pathname === itemPath && !searchParams.has('tab');
  }

  // For ?tab=KEY items, active when pathname matches AND tab param matches.
  if (pathname !== itemPath) return false;
  const requiredTab = itemParams.get('tab');
  if (!requiredTab) return false;
  return searchParams.get('tab') === requiredTab || searchParams.get('tab') === itemKey;
}

function SidebarLink({
  href,
  label,
  badge,
  active,
  iconKey,
}: {
  href: string;
  label: string;
  badge: SidebarBadge | undefined;
  active: boolean;
  iconKey: string;
}) {
  return (
    <Link
      href={href}
      title={badge?.tooltip}
      className={`group flex items-center gap-2.5 pl-4 pr-3 py-2 text-[13px] font-semibold border-l-2 transition-colors ${
        active
          ? 'bg-orange-bg border-l-orange text-orange-d font-extrabold'
          : 'border-l-transparent text-ink hover:bg-paper hover:border-l-ink-30'
      }`}
    >
      <SidebarIcon key_={iconKey} active={active} />
      <span className="flex-1 truncate">{label}</span>
      {badge ? <SidebarBadgePill badge={badge} /> : null}
    </Link>
  );
}

function SidebarBadgePill({ badge }: { badge: SidebarBadge }) {
  const toneClass: Record<string, string> = {
    default: 'bg-ink-08 text-ink-50',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-error/15 text-error',
    hot: 'bg-orange text-paper',
  };
  const cls = toneClass[badge.tone] ?? toneClass.default;

  if (badge.kind === 'dot') {
    return <span className={`w-2 h-2 rounded-full ${cls}`} aria-label="active" />;
  }
  if (badge.kind === 'money') {
    return (
      <span className={`text-[9px] font-extrabold uppercase tracking-[0.08em] px-1.5 py-0.5 ${cls}`}>
        ${formatCount(badge.value ?? 0)}
      </span>
    );
  }
  if (badge.kind === 'hot') {
    return (
      <span className={`flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.08em] px-1.5 py-0.5 ${cls}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {badge.value}
      </span>
    );
  }
  // count
  return (
    <span className={`text-[9px] font-extrabold uppercase tracking-[0.05em] px-1.5 py-0.5 ${cls}`}>
      {badge.label ?? formatCount(badge.value ?? 0)}
    </span>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

// =====================================================================
// Icons (inline SVGs keyed by sidebar item key)
// =====================================================================

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function SidebarIcon({ key_, active }: { key_: string; active: boolean }) {
  const cls = `flex-shrink-0 ${active ? 'text-orange-d' : 'text-ink-50'}`;
  switch (key_) {
    case 'overview':
      return (
        <svg {...ICON_PROPS} className={cls}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      );
    case 'ai':
      return (
        <svg {...ICON_PROPS} className={cls}><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg>
      );
    case 'photos':
      return (
        <svg {...ICON_PROPS} className={cls}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      );
    case 'tasks':
      return (
        <svg {...ICON_PROPS} className={cls}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      );
    case 'team':
      return (
        <svg {...ICON_PROPS} className={cls}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      );
    case 'schedule':
      return (
        <svg {...ICON_PROPS} className={cls}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      );
    case 'takeoff':
      return (
        <svg {...ICON_PROPS} className={cls}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      );
    case 'map':
      return (
        <svg {...ICON_PROPS} className={cls}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
      );
    case 'pay-apps':
      return (
        <svg {...ICON_PROPS} className={cls}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      );
    case 'financials':
      return (
        <svg {...ICON_PROPS} className={cls}><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      );
    case 'subs':
      return (
        <svg {...ICON_PROPS} className={cls}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/></svg>
      );
    case 'inventory':
      return (
        <svg {...ICON_PROPS} className={cls}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
      );
    case 'checkins':
      return (
        <svg {...ICON_PROPS} className={cls}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      );
    case 'permits':
      return (
        <svg {...ICON_PROPS} className={cls}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      );
    default:
      return <span className="w-3.5" />;
  }
}

// =====================================================================
// Mobile trigger (hamburger button) — used by the layout
// =====================================================================

export function ProjectMobileTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="md:hidden p-2 -ml-2 text-ink hover:bg-cream-2 border border-line"
      aria-label="Open project navigation"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  );
}
