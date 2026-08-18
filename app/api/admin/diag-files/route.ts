/**
 * Diagnostic endpoint for master admins — shows what files are
 * actually in the DB for a given workspace. Use this to verify
 * that the recent upload-completed hook actually created a row.
 *
 * Hit: GET /api/admin/diag-files?workspaceId=org_2abc...
 *
 * The output is JSON listing the latest 20 File rows for the
 * workspace, plus a count. If the user says "I uploaded a file
 * but it's not showing up", this is the source of truth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!(await isMasterAdmin(userId))) {
    return NextResponse.json({ error: 'Master admin only' }, { status: 403 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    // No workspace specified: return a summary across all workspaces
    // the master can see (which is all of them).
    const total = await prisma.file.count();
    const recent = await prisma.file.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        workspace: { select: { id: true, slug: true, name: true } },
        uploader: { select: { id: true, email: true, name: true } },
      },
    });
    return NextResponse.json({ total, recent });
  }

  const total = await prisma.file.count({ where: { workspaceId } });
  const recent = await prisma.file.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      uploader: { select: { id: true, email: true, name: true } },
    },
  });
  return NextResponse.json({ workspaceId, total, recent });
}
