/**
 * Shared shape for the timesheet UI components.
 * The "open check-in" entry used by the banner.
 */
export interface OpenCheckIn {
  id: string;
  projectId: string;
  projectName: string;
  whoName: string;
  whoKind: 'employee' | 'sub' | 'unknown';
  checkedInAt: string;
  hoursOpen: number;
  siteLabel: string | null;
}
