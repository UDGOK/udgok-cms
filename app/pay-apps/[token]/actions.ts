'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db/client';

export async function recordPayAppView(token: string, viewerEmail: string | null) {
  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;
  const referrer = hdrs.get('referer') ?? null;

  const payApp = await prisma.payApp.findUnique({ where: { shareToken: token } });
  if (!payApp) return { error: 'Not found' };

  await prisma.payAppViewEvent.create({
    data: {
      payAppId: payApp.id,
      viewerEmail,
      ipAddress: ip,
      userAgent,
      referrer,
    },
  });
  await prisma.payApp.update({
    where: { id: payApp.id },
    data: {
      viewCount: { increment: 1 },
      firstViewedAt: payApp.firstViewedAt ?? new Date(),
      ...(payApp.status === 'SENT' ? { status: 'VIEWED' as const } : {}),
    },
  });
  return { ok: true };
}
