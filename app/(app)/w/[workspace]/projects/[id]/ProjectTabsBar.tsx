import { ProjectTabs, type ProjectTab } from './ProjectTabs';
import { listProjectPermits, summarizePermits } from '@/lib/permits/queries';
import { countProjectPhotosByPhase } from '@/lib/photos/queries';

interface ProjectTabsBarProps {
  workspaceSlug: string;
  projectId: string;
  taskCount: number;
  payAppCount: number;
  subAssignmentCount: number;
  teamMemberCount: number;
}

/**
 * Server component that fetches live counts and renders the project
 * tab bar. Used by all dedicated routes (photos, pay-apps, pay-apps/[id])
 * so users can navigate freely between tabs and dedicated pages.
 */
export async function ProjectTabsBar({
  workspaceSlug,
  projectId,
  taskCount,
  payAppCount,
  subAssignmentCount,
  teamMemberCount,
}: ProjectTabsBarProps) {
  const [permits, photoCounts] = await Promise.all([
    listProjectPermits(projectId),
    countProjectPhotosByPhase(projectId),
  ]);
  const permitSummary = summarizePermits(permits);
  const permitsBadge = permitSummary.overdueInspections > 0
    ? permitSummary.overdueInspections
    : permits.length > 0
      ? permits.length
      : undefined;

  const totalPhotos = photoCounts.ROUGH_IN + photoCounts.FINAL;
  const base = `/w/${workspaceSlug}/projects/${projectId}`;

  const tabs: ProjectTab[] = [
    { key: 'overview', label: 'Overview', href: base },
    { key: 'photos', label: 'Photos', href: `${base}/photos`, badge: totalPhotos > 0 ? totalPhotos : undefined },
    { key: 'tasks', label: 'Tasks', href: `${base}?tab=tasks`, badge: taskCount > 0 ? taskCount : undefined },
    { key: 'team', label: 'Team', href: `${base}?tab=team`, badge: teamMemberCount > 0 ? teamMemberCount : undefined },
    { key: 'schedule', label: 'Schedule', href: `${base}?tab=schedule` },
    { key: 'permits', label: 'Permits', href: `${base}?tab=permits`, badge: permitsBadge },
    { key: 'pay-apps', label: 'Pay apps', href: `${base}/pay-apps`, badge: payAppCount > 0 ? payAppCount : undefined },
    { key: 'subs', label: 'Subs', href: `${base}?tab=subs`, badge: subAssignmentCount > 0 ? subAssignmentCount : undefined },
  ];

  return <ProjectTabs tabs={tabs} />;
}
