/**
 * Client-level file upload. Direct browser → Vercel Blob via
 * `handleUpload` token — bypasses the 4.5MB function body limit.
 *
 * Replaces the old `multipart/form-data` POST → `put()` pattern
 * that silently failed for files >4.5MB (Vercel hard cap).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

interface ClientFileTokenPayload {
  workspaceId: string;
  uploaderId: string;
  clientId: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) throw new Error('Missing client payload');
        const meta = JSON.parse(clientPayload) as Partial<ClientFileTokenPayload>;
        if (!meta.workspaceId || !meta.clientId) {
          throw new Error('workspaceId and clientId required');
        }
        // Confirm the client exists + belongs to the workspace
        const client = await prisma.client.findFirst({
          where: { id: meta.clientId, workspaceId: meta.workspaceId },
          select: { id: true },
        });
        if (!client) throw new Error('Client not found in workspace');
        await requireRole(meta.workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

        return {
          allowedContentTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'image/gif',
            'application/octet-stream',
          ],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          console.error('[handleUpload] onUploadCompleted called without tokenPayload');
          return;
        }
        try {
          const meta = JSON.parse(tokenPayload) as ClientFileTokenPayload;
          const filename = blob.pathname.split('/').pop() ?? 'file';
          let size = 0;
          try {
            const head = await fetch(blob.url, { method: 'HEAD' });
            const cl = head.headers.get('content-length');
            if (cl) size = Number(cl);
          } catch {
            // best-effort
          }
          const kind = blob.contentType?.startsWith('image/') ? 'PHOTO' : 'DOCUMENT';
          await prisma.file.create({
            data: {
              workspaceId: meta.workspaceId,
              uploaderId: meta.uploaderId,
              clientId: meta.clientId,
              url: blob.url,
              filename,
              mimeType: blob.contentType ?? 'application/octet-stream',
              size,
              kind: kind as 'PHOTO' | 'DOCUMENT',
            },
          });
        } catch (err) {
          console.error('[handleUpload] onUploadCompleted failed:', err);
        }
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 400 });
  }
}
