'use client';

import { useDrawer } from './MobileShellClient';
import { Topbar } from './Topbar';

export function TopbarWithDrawer({
  allWorkspaces,
}: {
  allWorkspaces: Array<{ id: string; slug: string; name: string; role: string }>;
}) {
  const openDrawer = useDrawer();
  return <Topbar allWorkspaces={allWorkspaces} onOpenMobileDrawer={openDrawer} />;
}
