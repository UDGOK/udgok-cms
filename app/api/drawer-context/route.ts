import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ signedIn: false }, { status: 200 });
  }

  // Find primary workspace (oldest membership)
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    include: { workspace: { select: { slug: true } } },
  });

  const master = await isMasterAdmin(userId);

  return NextResponse.json({
    signedIn: true,
    primaryWorkspaceSlug: membership?.workspace.slug ?? null,
    isMasterAdmin: master,
  });
}
