/**
 * TEMPORARY debug route - calls the same code path the CO detail page uses.
 * Returns the actual error so we can see what's failing in production.
 *
 * DELETE AFTER DEBUGGING.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getChangeOrder } from '@/lib/change-orders/queries';
import { getProjectSidebarStatus } from '@/lib/projects/sidebar-status';
import { requireMembership } from '@/lib/auth/require-membership';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const coId = req.nextUrl.searchParams.get('coId');
  const projectId = req.nextUrl.searchParams.get('projectId');
  const workspaceSlug = req.nextUrl.searchParams.get('workspaceSlug') ?? 'udgok';
  
  if (!coId || !projectId) {
    return NextResponse.json({ error: 'coId and projectId required' });
  }
  
  const results: Record<string, any> = {};
  
  try {
    results.membership = await requireMembership(workspaceSlug);
  } catch (e: any) {
    results.membershipError = e.message;
  }
  
  try {
    if (results.membership) {
      results.co = await getChangeOrder(coId, results.membership.workspace.id);
    }
  } catch (e: any) {
    results.coError = e.message + ' | stack: ' + e.stack?.slice(0, 500);
  }
  
  try {
    if (results.membership) {
      results.sidebar = await getProjectSidebarStatus(results.membership.workspace.id, projectId);
    }
  } catch (e: any) {
    results.sidebarError = e.message + ' | stack: ' + e.stack?.slice(0, 500);
  }
  
  return NextResponse.json(results, { status: 200 });
}
