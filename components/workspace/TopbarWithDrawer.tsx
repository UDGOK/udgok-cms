'use client';

import { useDrawer } from './MobileShellClient';
import { Topbar } from './Topbar';

export function TopbarWithDrawer({
  allWorkspaces,
  isMasterAdmin,
}: {
  allWorkspaces: Array<{ id: string; slug: string; name: string; role: string }>;
  isMasterAdmin?: boolean;
}) {
  const openDrawer = useDrawer();
  return (
    <Topbar
      allWorkspaces={allWorkspaces}
      onOpenMobileDrawer={openDrawer}
      isMasterAdmin={isMasterAdmin}
    />
  );
}
