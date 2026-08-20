'use client';

import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useWorkspace } from './WorkspaceContext';
import { usePresence } from '@/components/presence/PresenceProvider';
import { PresenceDot } from '@/components/presence/PresenceDot';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PUSH_ROLES } from '@/lib/notifications/types';
import Link from 'next/link';

interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
  role: string;
}

export function Topbar({
  allWorkspaces = [],
  onOpenMobileDrawer,
  isMasterAdmin = false,
  workspaceMembers = [],
}: {
  allWorkspaces?: WorkspaceOption[];
  onOpenMobileDrawer?: () => void;
  isMasterAdmin?: boolean;
  workspaceMembers?: Array<{ id: string; name: string; role: string }>;
}) {
  const { name, slug, role, id } = useWorkspace();
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
    <header className="bg-paper border-b border-line flex items-center gap-4 px-4 md:px-6 py-3 md:py-3.5">
      {/* Mobile: hamburger */}
      <button
        type="button"
        onClick={onOpenMobileDrawer}
        aria-label="Open menu"
        className="md:hidden w-10 h-10 -ml-2 flex items-center justify-center text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="text-[12px] font-semibold text-ink-50 flex items-center gap-2 min-w-0">
        <span className="hidden md:inline">
          <WorkspaceSwitcher current={{ id, slug, name, role }} workspaces={allWorkspaces} />
        </span>
        {/* Mobile: just show workspace name (truncated) */}
        <span className="md:hidden font-bold uppercase text-ink truncate text-[13px]">
          {name}
        </span>
        {crumb ? <span className="text-ink-30 hidden md:inline">/</span> : null}
        {crumb ? (
          <span className="font-extrabold uppercase tracking-tight text-ink hidden md:inline truncate">
            {crumb}
          </span>
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

        {/* Mobile: compact online count chip */}
        <Link
          href={`/w/${slug}/team`}
          className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-cream border border-line text-[11px]"
          title="Team presence"
        >
          <PresenceDot status={onlineCount > 0 ? 'online' : 'offline'} />
          <span className="font-extrabold text-ink">
            <span className="text-success">{onlineCount}</span>
          </span>
        </Link>

        <Link
          href={`/w/${slug}/scan`}
          className="w-[34px] h-[34px] flex items-center justify-center bg-paper border border-line text-ink-70 hover:border-ink hover:text-ink"
          aria-label="Scan barcode or QR"
          title="Scan"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </Link>

        {isMasterAdmin ? (
          <Link
            href="/admin"
            className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d"
            title="Master admin"
          >
            <span>👑</span>
            <span>Admin</span>
          </Link>
        ) : null}

        <NotificationBell
          workspaceId={id}
          workspaceSlug={slug}
          canPush={(PUSH_ROLES as readonly string[]).includes(role)}
          members={workspaceMembers}
        />

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
