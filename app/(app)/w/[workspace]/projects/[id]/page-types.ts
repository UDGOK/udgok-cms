/**
 * Page-level types for app/(app)/w/[workspace]/projects/[id]/page.tsx
 * and its extracted tab files.
 *
 * These were previously declared inline at the top of page.tsx.
 * They're hoisted into a dedicated module so the extracted tab
 * files in ./tabs/ can import them without pulling the whole
 * 1,603-LOC page along.
 */


export interface ProjectUser {
  id: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  assignee: ProjectUser | null;
  createdBy: { id: string; name: string | null } | null;
}

export interface ProjectDivision {
  id: string;
  code: string;
  trade: string;
  budget: number | { toString(): string };
  subcontractorName: string | null;
  subLinks: { assignment: { subcontractor: { id: string; name: string } } }[];
  payAppLines: { thisDrawAmount: number | { toString(): string } }[];
}

export interface ProjectPayApp {
  id: string;
  drawNumber: number;
  status: string;
  totalContract: number | { toString(): string };
  totalPrevious: number | { toString(): string };
  totalThisDraw: number | { toString(): string };
  totalBalance: number | { toString(): string };
  periodStart: Date;
  periodEnd: Date;
  viewCount: number;
  createdAt: Date;
  divisions: { projectDivisionId: string; thisDrawAmount: number | { toString(): string } }[];
}

export interface ProjectSubAssignment {
  id: string;
  status: string;
  contractAmount: number | { toString(): string };
  notes: string | null;
  subcontractor: { id: string; name: string; primaryTrade: string | null };
  divisionLinks: { id: string; division: { id: string; code: string; trade: string } }[];
}

export interface ProjectData {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  contractValue: number | { toString(): string } | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // Per-project permit portal override. When set, the
  // JurisdictionCard surfaces this URL instead of the
  // matched city's default. See Project.permitPortalUrl.
  permitPortalUrl: string | null;
  permitPortalLabel: string | null;
  permitPortalNotes: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodedAt: Date | null;
  geocodeSource: string | null;
  geocodedAddress: string | null;
  client: { id: string; name: string } | null;
  deal: { id: string; title: string; stage: string } | null;
  // The source estimate that was converted into this
  // project. Used to surface the "Seed from estimate"
  // banner on projects that were created before the
  // convert action learned to seed divisions + tasks.
  sourceEstimate: {
    id: string;
    number: string;
    lineItems: { id: string }[];
  } | null;
  members: { user: ProjectUser; userId: string; role: string | null }[];
  divisions: ProjectDivision[];
  payApps: ProjectPayApp[];
  bimModels: {
    id: string;
    url: string;
    filename: string;
    size: number;
    createdAt: Date;
    takeoffs?: { id: string; status: string; error: string | null; createdAt: Date }[];
  }[];
  bimTakeoffs: {
    id: string;
    bimModelId: string;
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
    result: import('@/lib/takeoff/types').TakeoffResult | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  subAssignments: ProjectSubAssignment[];
  tasks: ProjectTask[];
  files: { id: string; filename: string; url: string }[];
  notes: { id: string; body: string; createdAt: Date }[];
}

export interface PermitInspection {
  id: string;
  type: string;
  result: string;
  scheduledDate: Date | null;
  completedDate: Date | null;
  inspectorName: string | null;
  scheduledBy: string | null;
  notes: string | null;
}

export interface PermitWithInspections {
  id: string;
  permitNumber: string | null;
  type: string;
  status: string;
  jurisdiction: string | null;
  appliedDate: Date | null;
  issuedDate: Date | null;
  expirationDate: Date | null;
  fee: number | { toString(): string } | null;
  notes: string | null;
  inspections: PermitInspection[];
}
