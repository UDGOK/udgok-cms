import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for listRecentScansForWorkspace. The query function
 * batch-resolves matched entity names in parallel (one query
 * per type, not N+1 inside the map). These tests verify the
 * shape of the returned rows and the empty-state behavior.
 */

const scanFindMany = vi.fn();
const projectFindMany = vi.fn();
const subFindMany = vi.fn();
const clientFindMany = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    scanEvent: { findMany: (...args: unknown[]) => scanFindMany(...args) },
    project: { findMany: (...args: unknown[]) => projectFindMany(...args) },
    subcontractor: { findMany: (...args: unknown[]) => subFindMany(...args) },
    client: { findMany: (...args: unknown[]) => clientFindMany(...args) },
  },
}));

import { listRecentScansForWorkspace } from '../queries';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: empty
  scanFindMany.mockResolvedValue([]);
  projectFindMany.mockResolvedValue([]);
  subFindMany.mockResolvedValue([]);
  clientFindMany.mockResolvedValue([]);
});

describe('listRecentScansForWorkspace', () => {
  it('returns an empty array when there are no scans', async () => {
    const rows = await listRecentScansForWorkspace('ws_1');
    expect(rows).toEqual([]);
    // The matched-entity batch queries should NOT run when
    // there are no rows (saves a round-trip on first load).
    expect(projectFindMany).not.toHaveBeenCalled();
    expect(subFindMany).not.toHaveBeenCalled();
    expect(clientFindMany).not.toHaveBeenCalled();
  });

  it('returns scans newest-first (Prisma orderBy is the caller\'s job)', async () => {
    scanFindMany.mockResolvedValue([
      { id: 's1', code: 'CM-2024', source: 'camera', matched: 'project', matchedId: 'p1', createdAt: new Date('2026-08-18T17:00:00Z') },
    ]);
    projectFindMany.mockResolvedValue([{ id: 'p1', name: 'Clarus Medical' }]);

    const rows = await listRecentScansForWorkspace('ws_1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 's1',
      code: 'CM-2024',
      source: 'camera',
      matched: 'project',
      matchedId: 'p1',
      projectName: 'Clarus Medical',
      subName: null,
      clientName: null,
    });
  });

  it('resolves sub names when matched="sub"', async () => {
    scanFindMany.mockResolvedValue([
      { id: 's2', code: 'yasir@udgok.com', source: 'manual', matched: 'sub', matchedId: 'u1', createdAt: new Date() },
    ]);
    subFindMany.mockResolvedValue([{ id: 'u1', name: 'Yasir Qureshi' }]);

    const rows = await listRecentScansForWorkspace('ws_1');
    expect(rows[0].subName).toBe('Yasir Qureshi');
    expect(rows[0].projectName).toBeNull();
  });

  it('resolves client names when matched="client"', async () => {
    scanFindMany.mockResolvedValue([
      { id: 's3', code: 'CL-001', source: 'camera', matched: 'client', matchedId: 'c1', createdAt: new Date() },
    ]);
    clientFindMany.mockResolvedValue([{ id: 'c1', name: 'Clarus Medical' }]);

    const rows = await listRecentScansForWorkspace('ws_1');
    expect(rows[0].clientName).toBe('Clarus Medical');
  });

  it('leaves matchedName null when matched is null (not-found case)', async () => {
    scanFindMany.mockResolvedValue([
      { id: 's4', code: 'UPC-1234', source: 'manual', matched: null, matchedId: null, createdAt: new Date() },
    ]);

    const rows = await listRecentScansForWorkspace('ws_1');
    expect(rows[0].matched).toBeNull();
    expect(rows[0].matchedId).toBeNull();
    expect(rows[0].projectName).toBeNull();
    expect(rows[0].subName).toBeNull();
    expect(rows[0].clientName).toBeNull();
  });

  it('respects the limit parameter', async () => {
    scanFindMany.mockResolvedValue([]);
    await listRecentScansForWorkspace('ws_1', 25);
    expect(scanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });
});
