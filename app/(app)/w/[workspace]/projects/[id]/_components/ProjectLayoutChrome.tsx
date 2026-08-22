'use client';

/**
 * ProjectLayoutChrome — the per-page wrapper inside the project layout.
 *
 *   ┌───────────────────────────────────────┐
 *   │ [☰]  PROJECT · NAME         [← back] │  ← mobile-only sticky header
 *   ├──────────────┬────────────────────────┤
 *   │              │                        │
 *   │  <Sidebar>   │  <children>            │
 *   │              │                        │
 *   └──────────────┴────────────────────────┘
 *
 * Renders the desktop sidebar (always visible at md+), the
 * mobile-only sticky header (with hamburger + project name +
 * back-to-overview button), and the page content area.
 *
 * The mobile drawer is owned by the parent ProjectMobileShell —
 * we just trigger it via the useMobileDrawer() hook.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProjectSidebar, ProjectMobileTrigger } from './ProjectSidebar';
import { useMobileDrawer } from './ProjectMobileShell';
import type { SidebarBadge } from '@/lib/projects/sidebar-status';

interface Props {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  projectCode: string | null | undefined;
  badges: Record<string, SidebarBadge | undefined>;
  children: React.ReactNode;
}

export function ProjectLayoutChrome({
  workspaceSlug,
  projectId,
  projectName,
  projectCode,
  badges,
  children,
}: Props) {
  const { open: openDrawer } = useMobileDrawer();
  const pathname = usePathname();

  // The "back" button on the mobile header goes to the project
  // overview unless we're already there.
  const base = `/w/${workspaceSlug}/projects/${projectId}`;
  const isOverview = pathname === base;
  const backHref = isOverview
    ? `/w/${workspaceSlug}/projects`
    : base;
  const backLabel = isOverview ? '← All projects' : '← Project';

  return (
    <div className="flex w-full min-h-[calc(100vh-3.5rem)]">
      {/* Desktop sidebar */}
      <ProjectSidebar
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        projectName={projectName}
        projectCode={projectCode}
        badges={badges}
        variant="desktop"
      />

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* Mobile-only sticky header: hamburger + project name + back */}
        <div className="md:hidden sticky top-14 z-30 bg-paper border-b-2 border-ink px-2 py-1.5 flex items-center gap-1">
          <ProjectMobileTrigger onClick={openDrawer} />
          <div className="min-w-0 flex-1 px-1">
            <div className="label-mono truncate">{projectCode ?? 'PROJECT'}</div>
            <div className="font-extrabold text-[14px] truncate">{projectName}</div>
          </div>
          <Link
            href={backHref}
            className="px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-70 hover:text-ink flex-shrink-0"
          >
            {backLabel}
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
