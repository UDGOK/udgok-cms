/**
 * Presence list — returns the online/idle/offline status of every member
 * in the current user's workspace. Used by the Team page and the
 * presence provider to render dots + "last seen" timestamps.
 *
 * Online:  lastSeenAt within 5 minutes
 * Idle:    lastSeenAt within 60 minutes
 * Offline: otherwise
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { z } from '@/lib/validation';

export const runtime = 'nodejs';

const querySchema = z.object({
  workspaceId: z.string().min(1),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ workspaceId: url.searchParams.get('workspaceId') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  // Verify membership
  const me = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: parsed.data.workspaceId } },
    select: { id: true },
  });
  if (!me) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const members = await prisma.membership.findMany({
    where: { workspaceId: parsed.data.workspaceId },
    select: {
      id: true,
      role: true,
      lastSeenAt: true,
      isOnline: true,
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: [{ isOnline: 'desc' }, { lastSeenAt: 'desc' }, { user: { name: 'asc' } }],
  });

  const now = Date.now();
  const presence = members.map((m) => {
    const last = m.lastSeenAt?.getTime() ?? 0;
    const ageMs = now - last;
    const status = ageMs < 5 * 60_000 ? 'online' : ageMs < 60 * 60_000 ? 'idle' : 'offline';
    return {
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      status,
      lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ members: presence, serverTime: now });
}
