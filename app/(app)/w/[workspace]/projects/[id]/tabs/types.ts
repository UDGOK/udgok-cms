/**
 * Shared types for the project page tabs.
 *
 * These were hoisted out of page.tsx (which was 1,603 LOC and
 * had 9 tab components inline) so each tab can import them
 * without circular references back to the page file.
 */

import type { ProjectData, ProjectUser, PermitWithInspections } from '../page-types';

export type { ProjectData, ProjectUser, PermitWithInspections };

/** Subcontractor shape used by the SubsTab. */
export type SubsListSub = {
  id: string;
  name: string;
  primaryTrade: string | null;
};

/** Permit summary used by the PermitsTab. */
export interface PermitsSummary {
  total: number;
  active: number;
  pending: number;
  approved: number;
  expired: number;
  upcomingInspections: number;
}

/** Public-applicants list used by the SubsTab. */
export interface SubsList {
  subs: SubsListSub[];
}
