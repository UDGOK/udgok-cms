/**
 * Subcontractor document upload. Direct browser → Vercel Blob via
 * `handleUpload` token — bypasses the 4.5MB function body limit.
 *
 * Replaces the old `multipart/form-data` POST → `put()` pattern
 * that silently failed for files >4.5MB.
 *
 * Metadata: subcontractorId + document kind (ID_CARD, W9, etc.)
 * are passed in the clientPayload → onUploadCompleted creates the
 * File row with the right kind, and the onUploadCompleted hook
 * updates the Subcontractor's `idScanned` / `w9OnFile` / timestamps.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

const DOC_KINDS = ['ID_CARD', 'W9', 'INSURANCE', 'LICENSE', 'OTHER'] as const;
type DocKind = (typeof DOC_KINDS)[number];

interface SubDocTokenPayload {
  workspaceId: string;
  uploaderId: string;
  subcontractorId: string;
  kind: DocKind;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) throw new Error('Missing client payload');
        const meta = JSON.parse(clientPayload) as Partial<SubDocTokenPayload>;
        if (!meta.workspaceId) throw new Error('workspaceId required');
        if (!meta.kind || !(DOC_KINDS as readonly string[]).includes(meta.kind)) {
          throw new Error(`Invalid document kind: ${meta.kind}`);
        }
        if (meta.subcontractorId !== params.id) {
          throw new Error('Subcontractor ID mismatch');
        }
        // Confirm sub exists in workspace
        const sub = await prisma.subcontractor.findFirst({
          where: { id: params.id, workspaceId: meta.workspaceId },
          select: { id: true },
        });
        if (!sub) throw new Error('Sub not found in workspace');
        await requireRole(meta.workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

        return {
          allowedContentTypes: [
            'application/pdf',
            'image/jpeg', 'image/png', 'image/heic', 'image/webp',
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
          const meta = JSON.parse(tokenPayload) as SubDocTokenPayload;
          const filename = blob.pathname.split('/').pop() ?? 'file';
          let size = 0;
          try {
            const head = await fetch(blob.url, { method: 'HEAD' });
            const cl = head.headers.get('content-length');
            if (cl) size = Number(cl);
          } catch {
            // best-effort
          }
          await prisma.file.create({
            data: {
              workspaceId: meta.workspaceId,
              uploaderId: meta.uploaderId,
              subcontractorId: meta.subcontractorId,
              url: blob.url,
              filename,
              mimeType: blob.contentType ?? 'application/octet-stream',
              size,
              kind: 'DOCUMENT',
              // Use a category that signals what kind of doc this is
              category: meta.kind.toLowerCase(),
            },
          });
          // Update sub flags + timestamps based on kind
          const now = new Date();
          const updates: Record<string, unknown> = {};
          if (meta.kind === 'ID_CARD') {
            updates.idScanned = true;
            updates.idScannedAt = now;
          } else if (meta.kind === 'W9') {
            updates.w9OnFile = true;
            updates.w9ScannedAt = now;
          }
          if (Object.keys(updates).length > 0) {
            await prisma.subcontractor.updateMany({
              where: { id: meta.subcontractorId, workspaceId: meta.workspaceId },
              data: updates,
            });
          }
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
