import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { put } from '@vercel/blob';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const fd = await req.formData();
  const file = fd.get('file');
  const clientId = fd.get('clientId');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 });
  }
  if (typeof clientId !== 'string' || !clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  // The workspace slug is encoded in the URL — derive it from the
  // uploaded file path or the auth context. Since we don't have it
  // directly here, we look up the client first to get its workspace.
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: { id: true, workspaceId: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  await requireRole(client.workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  // Upload to Vercel Blob
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = await put(
    `${client.workspaceId}/clients/${clientId}/${Date.now()}-${safeName}`,
    file,
    { access: 'public' },
  );

  // Determine file kind from MIME type
  const kind =
    file.type.startsWith('image/') ? 'PHOTO' :
    'DOCUMENT';

  const record = await prisma.file.create({
    data: {
      workspaceId: client.workspaceId,
      uploaderId: userId,
      clientId,
      url: blob.url,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      kind: kind as 'PHOTO' | 'DOCUMENT',
    },
    select: { id: true, url: true },
  });

  return NextResponse.json({ id: record.id, url: record.url });
}
