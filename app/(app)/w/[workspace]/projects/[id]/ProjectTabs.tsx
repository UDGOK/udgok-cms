'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

export interface ProjectTab {
  key: string;
  label: string;
  href: string;
  badge?: string | number;
  /** When true, link is external (mailto:, https://) */
  external?: boolean;
}

/**
 * ProjectTabs — the horizontal nav below the project header.
 *
 * Design intent (interior-designer pass, Aug 2026):
 *
 *   - One row of pills, each an icon + label + optional small
 *     numeric badge. The eye should land on the active pill
 *     first (soft orange tint) and scan the row left to right
 *     without competing noise.
 *
 *   - Mixed case ("Photos", not "PHOTOS"). The all-caps-with-
 *     letter-spacing treatment reads like a control panel and
 *     makes 11 tabs feel like 11 alarms. Title case reads like
 *     a navigation menu.
 *
 *   - Active state is a soft tinted background, not an
 *     underline. Underlines draw a line through the whole nav
 *     and break the reading rhythm. A pill-shaped active state
 *     sits in its own bubble and doesn't bleed.
 *
 *   - Badges are tiny pill numbers, not chunky orange blocks.
 *     Big blocks of solid color compete with the active state
 *     ("is this tab active or just heavily badged?"). The
 *     numeric form keeps the count readable.
 *
 *   - Icons are 14px stroke SVGs at currentColor, so they
 *     inherit the tab's text color. Active = orange icon,
 *     inactive = stone icon. No "two systems of color".
 *
 *   - Mobile: horizontal scroll with scroll-snap so fingers
 *     land on a tab, not between two. The scrollbar is
 *     hidden so the nav doesn't look like an overflow bug.
 */
export function ProjectTabs({ tabs }: { tabs: ProjectTab[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <nav
      aria-label="Project sections"
      className="mt-4 -mx-1 px-1 border-b border-line/60 overflow-x-auto overflow-y-hidden scrollbar-hide"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      <ul className="flex items-center gap-0.5 min-w-max">
        {tabs.map((t) => {
          const [tabPath, tabSearch = ''] = t.href.split('?');
          const isActive =
            !t.external &&
            pathname === tabPath &&
            paramsMatch(searchParams, tabSearch);
          const icon = TAB_ICONS[t.key];
          const baseClass =
            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] whitespace-nowrap transition-colors scroll-snap-start';
          const stateClass = isActive
            ? 'bg-orange/12 text-orange-d font-semibold [&_svg]:text-orange shadow-[inset_0_0_0_1px_rgba(255,90,31,0.18)]'
            : 'text-ink-50 hover:text-ink hover:bg-paper-2 font-medium';
          const Tag = t.external ? 'a' : Link;
          const extraProps = t.external
            ? { target: '_blank', rel: 'noopener' }
            : {};
          return (
            <li key={t.key}>
              <Tag
                href={t.href}
                className={`${baseClass} ${stateClass}`}
                aria-current={isActive ? 'page' : undefined}
                {...extraProps}
              >
                {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
                <span>{t.label}</span>
                {t.badge !== undefined ? (
                  <span
                    className={`text-[10px] font-mono leading-none px-1.5 min-w-[20px] h-[18px] inline-flex items-center justify-center rounded-full ${
                      isActive
                        ? 'bg-orange/20 text-orange-d'
                        : 'bg-paper-2 text-ink-50'
                    }`}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </Tag>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Icon registry. Each tab key gets one stroke SVG at the
 * project-page nav size (14×14, strokeWidth 2). Add a new entry
 * here when you add a new tab key on the project page.
 *
 * We keep the icons inside this component (instead of passing
 * them as props from the page) so the page-side tab config
 * stays a flat list of `{ key, label, href, badge? }` and
 * adding a tab is one line of code.
 */
const TAB_ICONS: Record<string, ReactNode> = {
  overview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  ai: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 5.6L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-1.4z" />
    </svg>
  ),
  photos: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  tasks: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  team: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  schedule: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  permits: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z" />
      <rect x="5" y="6" width="14" height="16" rx="2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  takeoff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  map: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  'pay-apps': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  subs: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
};

/**
 * Returns true when the live search params satisfy the tab's static
 * search string. Two hrefs are considered "matching" if:
 *   - the live params contain every key=value the tab requires, AND
 *   - any extra live params that AREN'T in the tab string are
 *     ignored (so /w/.../projects/abc?tab=tasks&foo=bar still
 *     highlights the Tasks tab).
 *
 * An empty `tabSearch` (no query string on the href) matches when
 * the current URL has no query params at all.
 */
function paramsMatch(
  live: URLSearchParams,
  tabSearch: string,
): boolean {
  const required = new URLSearchParams(tabSearch);
  if (required.size === 0) {
    const liveKeys = Array.from(live.keys());
    if (liveKeys.some((k) => k === 'tab')) return false;
    return true;
  }
  for (const [k, v] of Array.from(required.entries())) {
    if (live.get(k) !== v) return false;
  }
  return true;
}
