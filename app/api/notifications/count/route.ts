/**
 * GET /api/notifications/count
 *
 * Lightweight unread-count endpoint for the bell
 * badge. Used by the 30-60s poll when the panel is
 * closed. Cheaper than the full panel fetch because
 * it returns just an integer.
 *
 * Auth: required. Cache: no-store.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUnreadCount } from '@/lib/notifications/queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const count = await getUnreadCount(userId);
    return NextResponse.json(
      { count },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      },
    );
  } catch (err) {
    console.error('[notifications] count fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch count' },
      { status: 500 },
    );
  }
}
