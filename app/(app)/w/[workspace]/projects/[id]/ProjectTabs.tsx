'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  return (
    <div className="mt-4 flex items-center gap-1 border-b-2 border-line overflow-x-auto -mx-1 px-1">
      {tabs.map((t) => {
        const isActive = !t.external && pathname === t.href;
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
