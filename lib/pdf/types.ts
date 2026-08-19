/**
 * Type definitions for the Project Book PDF.
 *
 * The PDF is a read-only projection of a project — we don't
 * re-query anything, we just take what `getProjectWithRelations`
 * already returns and shape it for the printer. This keeps the
 * PDF in sync with the in-app data model by construction: any
 * field the page shows is available to the PDF without separate
 * queries.
 *
 * The shape here is intentionally narrower than the full
 * Prisma include — we drop fields the PDF doesn't use (e.g.
 * file hashes, activity metadata blobs) to keep the type small
 * and the data flow obvious.
 */

export interface ProjectPayApp {
  id: string;
  drawNumber: number;
  status: string;
  totalContract: number | string | { toString(): string };
  totalPrevious: number | string | { toString(): string };
  totalThisDraw: number | string | { toString(): string };
  periodStart: Date | string;
  periodEnd: Date | string;
  createdAt: Date | string;
  acknowledgedByEmail?: string | null;
  acknowledgedByName?: string | null;
  acknowledgedAt?: Date | string | null;
}

export interface ProjectDivision {
  id: string;
  code: string;
  trade: string;
  budget: number | string | { toString(): string };
  subcontractorName: string | null;
  subLinks: {
    assignment: {
      subcontractor: { id: string; name: string };
    };
  }[];
  payAppLines: { thisDrawAmount: number | string | { toString(): string } }[];
}

export interface ProjectTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  assignee: { id: string; name: string | null; avatarUrl: string | null } | null;
}

export interface ProjectMember {
  userId: string;
  role: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export interface ProjectPermit {
  id: string;
  permitNumber: string | null;
  type: string;
  status: string;
  jurisdiction: string | null;
  appliedDate: Date | string | null;
  issuedDate: Date | string | null;
  expirationDate: Date | string | null;
  fee: number | string | { toString(): string } | null;
  notes: string | null;
}

export interface ProjectPhoto {
  id: string;
  url: string;
  filename: string;
  phase: string;
  room: string | null;
  area: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  takenAt: Date | string | null;
  uploader: { name: string | null; email: string };
}

export interface ProjectSubAssignment {
  id: string;
  status: string;
  createdAt: Date | string;
  subcontractor: { id: string; name: string; primaryTrade: string | null };
  divisionLinks: { division: { id: string; code: string; trade: string } }[];
}

export interface ProjectNote {
  id: string;
  body: string;
  createdAt: Date | string;
  user: { name: string | null; email: string };
}

export interface ProjectActivity {
  id: string;
  action: string;
  entityType: string;
  entityName: string | null;
  details: string | null;
  createdAt: Date | string;
  actor: { name: string | null; email: string } | null;
}

export interface ProjectData {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  contractValue: number | string | { toString(): string } | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodedAt: Date | string | null;
  geocodeSource: string | null;
  geocodedAddress: string | null;
  client: { id: string; name: string } | null;
  members: ProjectMember[];
  divisions: ProjectDivision[];
  payApps: ProjectPayApp[];
  tasks: ProjectTask[];
  subAssignments: ProjectSubAssignment[];
  permits: ProjectPermit[];
  notes: ProjectNote[];
  activity: ProjectActivity[];
  /** Total photos fetched. The PDF caps to 60 most-recent. */
  totalPhotos: number;
  /** The slice we'll embed — at most 60. */
  photos: ProjectPhoto[];
  /** Already-computed completion metrics, computed in the route handler. */
  completion: {
    overall: number;
    financial: number;
    tasks: number;
    schedule: number;
    subs: number;
    totalBilled: number;
    contractValue: number;
    remaining: number;
    tasksTotal: number;
    tasksDone: number;
    subsTotal: number;
    subsActive: number;
    daysElapsed: number | null;
    daysTotal: number | null;
    daysRemaining: number | null;
    onTrack: boolean | null;
  };
}
