import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const updateSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; taskId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const workspaceSlug = url.searchParams.get('workspace');
  if (!workspaceSlug) {
    return NextResponse.json({ error: 'workspace is required' }, { status: 400 });
  }
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const body = (await req.json()) as Record<string, unknown>;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  // Verify task belongs to this client + workspace
  const task = await prisma.task.findFirst({
    where: {
      id: params.taskId,
      clientId: params.id,
      workspaceId: workspace.id,
    },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  await prisma.task.update({
    where: { id: task.id },
    data: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
