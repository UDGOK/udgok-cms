'use client';

import { useState } from 'react';
import { MobileDrawer } from './MobileDrawer';
import { MobileTabBar } from './MobileTabBar';

interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
  role: string;
}

/**
 * MobileShell — wraps the entire app content. On mobile, it provides:
 *   - A hamburger-triggered left drawer with full nav + workspace switcher
 *   - A bottom tab bar with the 5 most-used sections
 * On desktop, this is a no-op (the existing sidebar is used).
 *
 * Must be a client component because it manages open/close state.
 */
export function MobileShell({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  workspaceId,
  allWorkspaces,
  children,
}: {
  workspaceId: string;
  allWorkspaces: WorkspaceOption[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {children}

      {/* Bottom tab bar (mobile only) */}
      <MobileTabBar onMoreClick={() => setDrawerOpen(true)} />

      {/* Slide-in drawer (mobile only) */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        allWorkspaces={allWorkspaces}
      />
    </>
  );
}
