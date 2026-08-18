'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export interface ProjectTab {
  key: string;
  label: string;
  href: string;
  badge?: string | number;
  /** When true, link is external (mailto:, https://) */
  external?: boolean;
}

export function ProjectTabs({ tabs }: { tabs: ProjectTab[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <div className="mt-4 flex items-center gap-1 border-b-2 border-line overflow-x-auto -mx-1 px-1">
      {tabs.map((t) => {
        // Split href into path + search so we can compare both parts.
        // `usePathname()` returns just the path (no `?tab=tasks`), so we
        // need to also check the query string for the active state.
        const [tabPath, tabSearch = ''] = t.href.split('?');
        const isActive =
          !t.external &&
          pathname === tabPath &&
          paramsMatch(searchParams, tabSearch);
        const baseClass = `px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] border-b-[3px] -mb-[2px] flex items-center gap-1.5 whitespace-nowrap transition-colors`;
        const activeClass = isActive
          ? 'border-orange text-ink'
          : 'border-transparent text-ink-50 hover:text-ink';
        if (t.external) {
          return (
            <a
              key={t.key}
              href={t.href}
              className={`${baseClass} ${activeClass}`}
              target="_blank"
              rel="noopener"
            >
              {t.label}
              {t.badge !== undefined ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 bg-orange text-paper">
                  {t.badge}
                </span>
              ) : null}
            </a>
          );
        }
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`${baseClass} ${activeClass}`}
          >
            {t.label}
            {t.badge !== undefined ? (
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-orange text-paper">
                {t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

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
    // No required params — the tab is the "default" view. It only
    // matches when the URL has no tab-related params at all (any
    // `?tab=...` present means a different tab is active).
    const liveKeys = Array.from(live.keys());
    if (liveKeys.some((k) => k === 'tab')) return false;
    return true;
  }
  for (const [k, v] of Array.from(required.entries())) {
    if (live.get(k) !== v) return false;
  }
  return true;
}
