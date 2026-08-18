import { prisma } from '@/lib/db/client';

export interface RecentScanRow {
  id: string;
  code: string;
  source: string;
  matched: string | null;
  matchedId: string | null;
  createdAt: Date;
  // Pre-resolved matched entity label, or null if not matched.
  projectName: string | null;
  subName: string | null;
  clientName: string | null;
}

/**
 * Returns the most recent scans for a workspace, newest first.
 * The matched entity's display name is pre-resolved so the page
 * can render "Found: Clarus Medical →" without a second
 * per-row query.
 *
 * `limit` defaults to 10 (matches the page's panel size).
 */
export async function listRecentScansForWorkspace(
  workspaceId: string,
  limit = 10,
): Promise<RecentScanRow[]> {
  const rows = await prisma.scanEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  if (rows.length === 0) return [];

  // Batch-resolve matched entity names. Doing this in one query
  // per type is much cheaper than N+1 inside the .map().
  const projectIds = rows.filter((r) => r.matched === 'project' && r.matchedId).map((r) => r.matchedId!);
  const subIds     = rows.filter((r) => r.matched === 'sub'     && r.matchedId).map((r) => r.matchedId!);
  const clientIds  = rows.filter((r) => r.matched === 'client'  && r.matchedId).map((r) => r.matchedId!);

  const [projects, subs, clients] = await Promise.all([
    projectIds.length
      ? prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    subIds.length
      ? prisma.subcontractor.findMany({ where: { id: { in: subIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    clientIds.length
      ? prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const subMap     = new Map(subs.map((s) => [s.id, s.name]));
  const clientMap  = new Map(clients.map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    source: r.source,
    matched: r.matched,
    matchedId: r.matchedId,
    createdAt: r.createdAt,
    projectName: r.matchedId && r.matched === 'project' ? projectMap.get(r.matchedId) ?? null : null,
    subName:     r.matchedId && r.matched === 'sub'     ? subMap.get(r.matchedId) ?? null : null,
    clientName:  r.matchedId && r.matched === 'client'  ? clientMap.get(r.matchedId) ?? null : null,
  }));
}
