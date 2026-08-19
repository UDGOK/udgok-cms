import { ProjectTabs } from './ProjectTabs';
import { getProjectTabs } from '@/lib/projects/tabs';

interface ProjectTabsBarProps {
  workspaceSlug: string;
  projectId: string;
  taskCount: number;
  payAppCount: number;
  subAssignmentCount: number;
  teamMemberCount: number;
  /** Optional counts the main project page already has. The
   *  bar re-uses them to avoid an extra round trip; routes
   *  that don't have them can pass nothing and the helper
   *  will fetch what's missing. */
  bimModelCount?: number;
  gpsPhotoCount?: number;
  /** AI board badge — count of warning/danger-level insights. */
  aiAlertCount?: number;
}

/**
 * Server component that renders the project tab bar. Used by
 * every project sub-route (photos, pay-apps list, pay-app detail,
 * new pay-app form) so the navigation is identical everywhere.
 *
 * All badge data flows through `getProjectTabs` in
 * lib/projects/tabs.ts — see the comment block there for why
 * keeping the tab config in one place matters.
 */
export async function ProjectTabsBar(props: ProjectTabsBarProps) {
  const tabs = await getProjectTabs(props);
  return <ProjectTabs tabs={tabs} />;
}
