'use client';

/**
 * ProjectMobileShell — client-side wrapper for the project layout.
 *
 * Holds the open/closed state of the mobile drawer (the sidebar
 * in mobile variant). Provides a `useMobileDrawer()` hook so the
 * layout's header can trigger the drawer open.
 *
 * The desktop sidebar is rendered directly in the layout (server
 * data flows through to the client component). The mobile drawer
 * is the same component, just hidden until open.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import { ProjectSidebar } from './ProjectSidebar';
import type { SidebarBadge } from '@/lib/projects/sidebar-status';

interface MobileDrawerCtx {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  toggle: () => void;
}

const Ctx = createContext<MobileDrawerCtx | null>(null);

export function useMobileDrawer() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMobileDrawer must be used inside ProjectMobileShell');
  return v;
}

interface ShellProps {
  children: ReactNode;
  projectName: string;
  projectCode: string | null | undefined;
  workspaceSlug: string;
  projectId: string;
  badges: Record<string, SidebarBadge | undefined>;
}

export function ProjectMobileShell({
  children,
  projectName,
  projectCode,
  workspaceSlug,
  projectId,
  badges,
}: ShellProps) {
  const [isOpen, setIsOpen] = useState(false);

  const value: MobileDrawerCtx = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
  };

  return (
    <Ctx.Provider value={value}>
      <div className="flex w-full">
        {children}
        <ProjectSidebar
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          projectName={projectName}
          projectCode={projectCode}
          badges={badges}
          variant="mobile"
          open={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </Ctx.Provider>
  );
}
