/**
 * /api/notifications — the bell's API.
 *
 *   GET    → panel payload (unread + earlier + count)
 *   PATCH  → mark read (single id, or all=true)
 *   DELETE → dismiss a single notification
 *
 * All three methods are pinned to the calling
 * userId; a caller can never read or mutate
 * another user's notifications.
 *
 * Auth: required (Clerk). Returns 401 otherwise.
 * Cache: no-store — the bell re-polls frequently
 * and the response is per-user.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getNotificationPanel } from '@/lib/notifications/queries';
import { markReadSchema } from '@/lib/notifications/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, must-revalidate' } as const;

// =====================================================================
// GET — bell panel payload
// =====================================================================

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const panel = await getNotificationPanel(userId);
    return NextResponse.json(panel, { headers: NO_STORE });
  } catch (err) {
    console.error('[notifications] panel fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500, headers: NO_STORE },
    );
  }
}

// =====================================================================
// PATCH — mark read (single id or all=true)
// =====================================================================

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = markReadSchema.safeParse({
    id: (formData.get('id') as string | null) || undefined,
    all: formData.get('all') === 'true',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    if (parsed.data.id) {
      const result = await prisma.notification.updateMany({
        where: { id: parsed.data.id, recipientId: userId },
        data: { readAt: new Date() },
      });
      if (result.count === 0) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404, headers: NO_STORE },
        );
      }
    } else if (parsed.data.all) {
      await prisma.notification.updateMany({
        where: {
          recipientId: userId,
          readAt: null,
          dismissedAt: null,
        },
        data: { readAt: new Date() },
      });
    } else {
      return NextResponse.json(
        { error: 'Provide id or all=true' },
        { status: 400, headers: NO_STORE },
      );
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error('[notifications] mark read failed:', err);
    return NextResponse.json(
      { error: 'Failed to mark read' },
      { status: 500, headers: NO_STORE },
    );
  }
}

// =====================================================================
// DELETE — dismiss a single notification
// =====================================================================

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const formData = await request.formData();
  const id = formData.get('id');
  if (typeof id !== 'string' || id.length === 0) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const result = await prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { dismissedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404, headers: NO_STORE },
      );
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error('[notifications] dismiss failed:', err);
    return NextResponse.json(
      { error: 'Failed to dismiss' },
      { status: 500, headers: NO_STORE },
    );
  }
}
