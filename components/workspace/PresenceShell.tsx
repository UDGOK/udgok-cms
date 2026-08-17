'use client';

import { PresenceProvider } from '@/components/presence/PresenceProvider';

export function PresenceShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  return <PresenceProvider workspaceId={workspaceId}>{children}</PresenceProvider>;
}
