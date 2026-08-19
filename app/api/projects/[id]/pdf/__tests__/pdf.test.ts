/**
 * Regression tests for the project book PDF route.
 *
 * We mock the prisma client and Clerk auth, then verify the
 * auth + permission gates. We don't try to actually render the
 * PDF in a unit test (that would require a DOM/Canvas environment
 * for react-pdf and would be slow + brittle). We trust react-pdf
 * to do its job and focus on the route logic.
 *
 * Coverage:
 *   - 401 when not signed in
 *   - 404 when project doesn't exist
 *   - 403 when user isn't a member of the workspace
 *   - 200 + application/pdf when authorized
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks — declared before importing the route so the module
// graph picks them up.
const mockAuth = vi.fn();
const mockProjectFindUnique = vi.fn();
const mockMembershipFindUnique = vi.fn();
const mockGetProjectWithRelations = vi.fn();
const mockListProjectPermits = vi.fn();
const mockListEntityActivity = vi.fn();
const mockNoteFindMany = vi.fn();
const mockPhotoFindMany = vi.fn();
const mockRenderToBuffer = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: { findUnique: (...args: unknown[]) => mockProjectFindUnique(...args) },
    membership: { findUnique: (...args: unknown[]) => mockMembershipFindUnique(...args) },
    note: { findMany: (...args: unknown[]) => mockNoteFindMany(...args) },
    projectPhoto: { findMany: (...args: unknown[]) => mockPhotoFindMany(...args) },
  },
}));

vi.mock('@/lib/projects/insights', () => ({
  getProjectWithRelations: (...args: unknown[]) => mockGetProjectWithRelations(...args),
  computeProjectCompletion: () => ({
    overall: 50, financial: 50, tasks: 50, schedule: 50, subs: 50,
    totalBilled: 100000, contractValue: 200000, remaining: 100000,
    tasksTotal: 4, tasksDone: 2, subsTotal: 0, subsActive: 0,
    daysElapsed: null, daysTotal: null, daysRemaining: null, onTrack: null,
  }),
  generateProjectInsights: () => [],
}));

vi.mock('@/lib/permits/queries', () => ({
  listProjectPermits: (...args: unknown[]) => mockListProjectPermits(...args),
}));

vi.mock('@/lib/activity/queries', () => ({
  listEntityActivity: (...args: unknown[]) => mockListEntityActivity(...args),
}));

vi.mock('@/lib/pdf/render', () => ({
  renderProjectPdf: (...args: unknown[]) => mockRenderToBuffer(...args),
}));

// We don't want real monitoring calls (they go to console.error
// which is fine in tests, but we want to keep the test output
// clean). Mock captureError to a no-op.
vi.mock('@/lib/monitoring', () => ({
  captureError: () => undefined,
  captureWarning: () => undefined,
}));

// We don't need the actual ProjectPdf component to do anything —
// we mock renderToBuffer so it just returns a fake PDF buffer.
mockRenderToBuffer.mockResolvedValue(Buffer.from('%PDF-1.4 fake', 'utf-8'));

// Now import the route handler.
import { GET } from '../route';

const PROJECT_ID = 'cm-test-project-id';
const WORKSPACE_ID = 'cm-test-workspace-id';
const USER_ID = 'user_test_123';

function makeRequest(): NextRequest {
  return new NextRequest(`https://cms.udgok.com/api/projects/${PROJECT_ID}/pdf`);
}

function makeCtx() {
  return { params: { id: PROJECT_ID } };
}

describe('GET /api/projects/[id]/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sensible defaults — tests override what they care about.
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockProjectFindUnique.mockResolvedValue({
      id: PROJECT_ID,
      code: 'TEST-001',
      name: 'Test Project',
      workspaceId: WORKSPACE_ID,
      workspace: { id: WORKSPACE_ID, slug: 'udgok' },
    });
    mockMembershipFindUnique.mockResolvedValue({ id: 'mem-1' });
    mockGetProjectWithRelations.mockResolvedValue({
      id: PROJECT_ID,
      name: 'Test Project',
      code: 'TEST-001',
      description: null,
      status: 'ACTIVE',
      startDate: new Date('2026-03-14'),
      endDate: new Date('2026-11-30'),
      contractValue: { toString: () => '200000' },
      address: null, city: null, state: null, zip: null,
      latitude: null, longitude: null,
      geocodedAt: null, geocodeSource: null, geocodedAddress: null,
      client: null,
      members: [],
      divisions: [],
      payApps: [],
      tasks: [],
      subAssignments: [],
    });
    mockListProjectPermits.mockResolvedValue([]);
    mockListEntityActivity.mockResolvedValue([]);
    mockNoteFindMany.mockResolvedValue([]);
    mockPhotoFindMany.mockResolvedValue([]);
  });

  it('returns 401 when not signed in', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    const res = await GET(makeRequest(), makeCtx());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/not signed in/i);
  });

  it('returns 404 when project does not exist', async () => {
    mockProjectFindUnique.mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeCtx());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/project not found/i);
  });

  it('returns 403 when user is not a member of the workspace', async () => {
    mockMembershipFindUnique.mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeCtx());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it('returns 200 with application/pdf when authorized', async () => {
    const res = await GET(makeRequest(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    // The attachment header is set with a sanitized filename.
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('.pdf');
    expect(disposition).toContain('TEST-001');
  });

  it('falls back to project name in filename when no code', async () => {
    mockProjectFindUnique.mockResolvedValueOnce({
      id: PROJECT_ID,
      code: null,
      name: 'The Building Job',
      workspaceId: WORKSPACE_ID,
      workspace: { id: WORKSPACE_ID, slug: 'udgok' },
    });
    const res = await GET(makeRequest(), makeCtx());
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('The-Building-Job');
  });

  it('returns 500 when PDF render fails', async () => {
    mockRenderToBuffer.mockRejectedValueOnce(new Error('react-pdf exploded'));
    const res = await GET(makeRequest(), makeCtx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/pdf generation failed/i);
  });
});
