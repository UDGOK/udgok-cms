'use client';

import { createContext, useContext, useState } from 'react';
import { MobileDrawer } from './MobileDrawer';
import { MobileTabBar } from './MobileTabBar';

interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
  role: string;
}

interface DrawerContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useDrawer(): () => void {
  const ctx = useContext(DrawerContext);
  if (!ctx) return () => {};
  return ctx.open;
}

export function MobileShellClient({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  workspaceId,
  allWorkspaces,
  isMasterAdmin,
  children,
}: {
  workspaceId: string;
  allWorkspaces: WorkspaceOption[];
  isMasterAdmin?: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const value: DrawerContextValue = {
    open: () => setDrawerOpen(true),
    close: () => setDrawerOpen(false),
    isOpen: drawerOpen,
  };

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <MobileTabBar onMoreClick={() => setDrawerOpen(true)} />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        allWorkspaces={allWorkspaces}
        isMasterAdmin={isMasterAdmin}
      />
    </DrawerContext.Provider>
  );
}
