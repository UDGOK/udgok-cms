'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Role } from '@prisma/client';

export interface WorkspaceContextValue {
  id: string;
  slug: string;
  name: string;
  role: Role;
  // IANA timezone string for the current user
  // (User.timezone). Used by date displays in
  // client components that don't otherwise have
  // access to the User row. Falls back to 'UTC' when
  // the user hasn't picked a timezone yet.
  timezone: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be called inside a WorkspaceProvider');
  }
  return ctx;
}
