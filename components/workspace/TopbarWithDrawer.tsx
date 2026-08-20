'use client';

import { useDrawer } from './MobileShellClient';
import { Topbar } from './Topbar';

export function TopbarWithDrawer({
  allWorkspaces,
  isMasterAdmin,
  members,
}: {
  allWorkspaces: Array<{ id: string; slug: string; name: string; role: string }>;
  isMasterAdmin?: boolean;
  members?: Array<{ id: string; name: string; role: string }>;
}) {
  const openDrawer = useDrawer();
  return (
    <Topbar
      allWorkspaces={allWorkspaces}
      onOpenMobileDrawer={openDrawer}
      isMasterAdmin={isMasterAdmin}
      workspaceMembers={members ?? []}
    />
  );
}
