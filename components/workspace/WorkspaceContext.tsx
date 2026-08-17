'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Role } from '@prisma/client';

export interface WorkspaceContextValue {
  id: string;
  slug: string;
  name: string;
  role: Role;
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
