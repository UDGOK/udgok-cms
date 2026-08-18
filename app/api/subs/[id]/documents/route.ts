import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { put } from '@vercel/blob';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB (camera shots can be big)

const DOC_KINDS = ['ID_CARD', 'W9', 'INSURANCE', 'LICENSE', 'OTHER'] as const;
type DocKind = (typeof DOC_KINDS)[number];

const labelByKind: Record<DocKind, string> = {
  ID_CARD: 'ID card',
  W9: 'W-9',
  INSURANCE: 'Insurance certificate',
  LICENSE: 'License',
  OTHER: 'Other',
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const workspaceSlug = url.searchParams.get('workspace');
  if (!workspaceSlug) {
    return NextResponse.json({ error: 'workspace is required' }, { status: 400 });
  }

  const fd = await req.formData();
  const file = fd.get('file');
  const kind = (fd.get('kind') as DocKind) ?? 'OTHER';

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 });
  }
  if (!DOC_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Invalid document kind' }, { status: 400 });
  }

  // Resolve workspace via the subcontractor
  const sub = await prisma.subcontractor.findFirst({
    where: { id: params.id },
    select: { id: true, workspaceId: true, name: true },
  });
  if (!sub) return NextResponse.json({ error: 'Sub not found' }, { status: 404 });
  await requireRole(sub.workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  // Upload to Vercel Blob under the sub's path so cleanup is easy
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = await put(
    `${sub.workspaceId}/subs/${sub.id}/${kind.toLowerCase()}-${Date.now()}-${safeName}`,
    file,
    { access: 'public' },
  );

  // Create the File row
  const record = await prisma.file.create({
    data: {
      workspaceId: sub.workspaceId,
      uploaderId: userId,
      subcontractorId: sub.id,
      url: blob.url,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      kind: 'DOCUMENT',
      category: kind, // ID_CARD / W9 / etc.
    },
    select: { id: true, url: true, category: true },
  });

  // Update the sub's flags + timestamps
  const now = new Date();
  if (kind === 'W9') {
    await prisma.subcontractor.update({
      where: { id: sub.id },
      data: { w9OnFile: true, w9ScannedAt: now },
    });
  } else if (kind === 'ID_CARD') {
    await prisma.subcontractor.update({
      where: { id: sub.id },
      data: { idScanned: true, idScannedAt: now },
    });
  }

  return NextResponse.json({
    id: record.id,
    url: record.url,
    kind: record.category,
    label: labelByKind[kind],
    subName: sub.name,
  });
}
