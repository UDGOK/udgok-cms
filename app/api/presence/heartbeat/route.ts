/**
 * Presence heartbeat — the client posts here every 60s to mark itself as
 * online. We also update lastSeenAt + isOnline on the current user's
 * membership in this workspace.
 *
 * This is intentionally simple: a single DB write per heartbeat. No
 * WebSockets, no external service. Polling + lastSeenAt > 5min = online
 * is good enough for a construction CMS team of <100 people.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { z } from '@/lib/validation';

const bodySchema = z.object({
  workspaceId: z.string().min(1),
});

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Verify the user is actually a member of this workspace.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: body.workspaceId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      lastSeenAt: new Date(),
      isOnline: true,
    },
  });

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
