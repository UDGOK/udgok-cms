'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from './WorkspaceContext';

interface Tab {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPrefix: string;
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}
function IconProjects() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function IconTasks() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function IconFiles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

export function MobileTabBar({ onMoreClick }: { onMoreClick?: () => void }) {
  const { slug } = useWorkspace();
  const pathname = usePathname();

  const tabs: Tab[] = [
    {
      label: 'Home',
      href: `/w/${slug}/dashboard`,
      matchPrefix: `/w/${slug}/dashboard`,
      icon: <IconHome />,
    },
    {
      label: 'Projects',
      href: `/w/${slug}/projects`,
      matchPrefix: `/w/${slug}/projects`,
      icon: <IconProjects />,
    },
    {
      label: 'Tasks',
      href: `/w/${slug}/tasks`,
      matchPrefix: `/w/${slug}/tasks`,
      icon: <IconTasks />,
    },
    {
      label: 'Files',
      href: `/w/${slug}/files`,
      matchPrefix: `/w/${slug}/files`,
      icon: <IconFiles />,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper border-t-2 border-ink"
      aria-label="Primary mobile navigation"
    >
      <div className="grid grid-cols-5 h-16">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'text-orange-d'
                  : 'text-ink-50 hover:text-ink'
              }`}
            >
              <span className="w-5 h-5">{tab.icon}</span>
              <span className={`text-[10px] font-extrabold uppercase tracking-[0.05em] ${isActive ? 'text-orange-d' : ''}`}>
                {tab.label}
              </span>
              {isActive ? (
                <span className="absolute top-0 w-10 h-[3px] bg-orange" />
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-1 text-ink-50 hover:text-ink transition-colors"
        >
          <span className="w-5 h-5">
            <IconMore />
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.05em]">More</span>
        </button>
      </div>
      {/* Safe area padding for iPhone home indicator */}
      <div className="h-[env(safe-area-inset-bottom)] bg-paper" />
    </nav>
  );
}
