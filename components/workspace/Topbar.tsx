'use client';

import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useWorkspace } from './WorkspaceContext';
import { usePresence } from '@/components/presence/PresenceProvider';
import { PresenceDot } from '@/components/presence/PresenceDot';
import Link from 'next/link';

export function Topbar() {
  const { name, slug } = useWorkspace();
  const pathname = usePathname();
  const { members } = usePresence();
  const segments = pathname.split('/').filter(Boolean);
  // Path is /w/[slug]/[section]/... — drop the workspace segment for the breadcrumb
  const crumb = segments
    .filter((s) => !s.startsWith('w') && segments.indexOf(s) > 1)
    .map((s) => s.replace(/-/g, ' '))
    .join(' / ');

  const onlineCount = members.filter((m) => m.status === 'online').length;
  const totalCount = members.length;

  return (
    <header className="bg-paper border-b border-line flex items-center gap-4 px-6 py-3.5">
      <div className="text-[12px] font-semibold text-ink-50 flex items-center gap-2">
        <span className="font-bold uppercase text-ink">{name}</span>
        {crumb ? <span className="text-ink-30">/</span> : null}
        {crumb ? (
          <span className="font-extrabold uppercase tracking-tight text-ink">{crumb}</span>
        ) : null}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Link
          href={`/w/${slug}/team`}
          className="hidden md:flex items-center gap-2 px-3 py-2 bg-cream border border-line text-xs hover:border-ink transition-colors"
          title="Team presence"
        >
          <PresenceDot status={onlineCount > 0 ? 'online' : 'offline'} />
          <span className="font-extrabold text-ink">
            <span className="text-success">{onlineCount}</span>
            <span className="text-ink-50">/</span>
            <span>{totalCount}</span>
          </span>
          <span className="text-ink-50 uppercase tracking-[0.05em] text-[10px] font-mono">online</span>
        </Link>

        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-cream border border-line min-w-[240px] text-xs text-ink-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Search clients, projects, tasks…</span>
          <kbd className="font-mono text-[9px] px-1.5 py-0.5 bg-paper border border-line ml-auto">
            ⌘K
          </kbd>
        </div>

        <button
          className="w-[34px] h-[34px] flex items-center justify-center bg-paper border border-line text-ink-70 hover:border-ink hover:text-ink relative"
          aria-label="Notifications"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange rounded-full border-2 border-paper" />
        </button>

        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-[30px] h-[30px]',
            },
          }}
        />
      </div>
    </header>
  );
}
