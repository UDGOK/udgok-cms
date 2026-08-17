import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const payApp = await prisma.payApp.findUnique({ where: { id: params.id } });
  if (!payApp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payApp.status === 'DRAFT') {
    return NextResponse.json({ error: 'Pay app is still a draft' }, { status: 400 });
  }

  await prisma.payApp.update({
    where: { id: payApp.id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
