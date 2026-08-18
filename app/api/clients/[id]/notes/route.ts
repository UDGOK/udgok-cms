import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const noteSchema = z.object({
  body: z.string().min(1, 'Note cannot be empty').max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Get workspace from query or derive from client
  const url = new URL(req.url);
  const workspaceSlug = url.searchParams.get('workspace');
  if (!workspaceSlug) {
    return NextResponse.json({ error: 'workspace is required' }, { status: 400 });
  }
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const body = (await req.json()) as { body?: string };
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  // Verify client belongs to this workspace
  const client = await prisma.client.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const note = await prisma.note.create({
    data: {
      authorId: userId,
      body: parsed.data.body,
      clientId: client.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: note.id });
}
