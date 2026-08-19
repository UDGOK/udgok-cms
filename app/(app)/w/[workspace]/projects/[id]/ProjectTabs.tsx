'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
 *   - Mixed case ("Photos", not "PHOTOS"). Title case reads
 *     like a navigation menu, not a control panel.
 *
 *   - Active state is a soft tinted background, not an
 *     underline. A pill-shaped active state sits in its own
 *     bubble and doesn't bleed across the nav.
 *
 *   - Badges are tiny pill numbers, not chunky blocks. Big
 *     blocks of solid color compete with the active state.
 *
 *   - Icons are 14px stroke SVGs at currentColor, so they
 *     inherit the tab's text color. Active = orange icon,
 *     inactive = stone icon. No "two systems of color".
 *
 *   - On narrow viewports the row is horizontally scrollable
 *     with scroll-snap. Two fades (left + right) hint that
 *     there's more beyond the visible area. The fade on the
 *     active side is suppressed so the active pill isn't
 *     visually clipped. scrollbar is hidden so the nav
 *     doesn't look like an overflow bug.
 *
 *   - After navigation we scroll the active tab into view
 *     (with a small inline padding) so the user can always
 *     see which tab they're on after a deep-link lands on
 *     a tab that's off-screen on mobile.
 */
export function ProjectTabs({ tabs }: { tabs: ProjectTab[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollerRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);
  // hasOverflow tracks whether the tab row is wider than the
  // visible area. We use it to render the edge-fade gradients
  // only when needed — they add visual noise on desktop where
  // everything already fits.
  const [hasOverflow, setHasOverflow] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState({ left: false, right: false });

  // Detect overflow + scroll position so the edge fades
  // match reality. Cheap (one reflow per scroll).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setHasOverflow(el.scrollWidth > el.clientWidth + 1);
      setScrolledToEnd({
        left: el.scrollLeft <= 1,
        right: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [tabs.length]);

  // After mount + on tab change, scroll the active tab into
  // view. The `inline: 'center'` is the perfectionist detail:
  // it lands the active pill in the middle of the viewport
  // on mobile so the user can see both the tab they came
  // from AND the next tab (orientation cue).
  useEffect(() => {
    const el = activeRef.current;
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    const elRect = el.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    // Only scroll if the active tab is off-screen
    if (elRect.left < scrollerRect.left || elRect.right > scrollerRect.right) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [pathname, searchParams]);

  return (
    <div className="relative mt-4">
      {/* Left fade — only when there's overflow AND we haven't
          scrolled all the way to the start. */}
      {hasOverflow && !scrolledToEnd.left ? (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-paper to-transparent"
        />
      ) : null}
      {/* Right fade — only when there's overflow AND we haven't
          scrolled to the end. */}
      {hasOverflow && !scrolledToEnd.right ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-l from-paper to-transparent"
        />
      ) : null}
      <nav
        ref={scrollerRef}
        aria-label="Project sections"
        className="-mx-1 px-1 border-b border-line/60 overflow-x-auto overflow-y-hidden scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <ul className="flex items-stretch gap-0.5 min-w-max">
          {tabs.map((t) => {
            const [tabPath, tabSearch = ''] = t.href.split('?');
            const isActive =
              !t.external &&
              pathname === tabPath &&
              paramsMatch(searchParams, tabSearch);
            const icon = TAB_ICONS[t.key];
            // Slightly larger touch target on mobile (py-2 = 32px
            // tap area) vs desktop (py-1.5 = 28px). The active
            // state is a pill of orange/12 over the same shape.
            const baseClass =
              'inline-flex items-center gap-1.5 px-2.5 py-2 md:py-1.5 rounded-md text-[13px] whitespace-nowrap transition-colors scroll-snap-start min-h-[36px] md:min-h-[32px]';
            const stateClass = isActive
              ? 'bg-orange/12 text-orange-d font-semibold [&_svg]:text-orange shadow-[inset_0_0_0_1px_rgba(255,90,31,0.18)]'
              : 'text-ink-50 hover:text-ink hover:bg-paper-2 font-medium';
            const Tag = t.external ? 'a' : Link;
            const extraProps = t.external
              ? { target: '_blank', rel: 'noopener' }
              : {};
            return (
              <li
                key={t.key}
                ref={isActive ? activeRef : null}
              >
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
    </div>
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
  inventory: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.91 8.84L8.56 2.23a1.93 1.93 0 0 0-1.81 0L3.1 4.13a1.93 1.93 0 0 0-.97 1.68v8.39a1.93 1.93 0 0 0 .97 1.68l12.35 6.6a1.93 1.93 0 0 0 1.81 0l3.65-1.95a1.93 1.93 0 0 0 .97-1.68V10.52a1.93 1.93 0 0 0-.97-1.68z" />
      <polyline points="7.09 6.31 12 8.83 16.91 6.31" />
      <line x1="12" y1="8.83" x2="12" y2="21.97" />
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
