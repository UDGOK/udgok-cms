/**
 * Workspace-level file upload. Direct browser → Vercel Blob via
 * `handleUpload` token — bypasses the 4.5MB function body limit so
 * 50–500MB floor-plan PDFs and site photos upload cleanly.
 *
 * Token payload (JSON-stringified) carries: workspaceId, category,
 * clientId?, projectId?, dealId?, latitude?, longitude?, takenAt?.
 * The browser POSTs the same shape so the metadata survives the
 * round trip.
 *
 * Flow:
 *   1. Browser calls POST → we return an upload token
 *   2. Browser PUTs the file directly to Vercel Blob
 *   3. onUploadCompleted fires here → we create the File row
 *      with the metadata from the token
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_CATEGORIES = [
  'brochures', 'marketing', 'floorplans', 'contracts',
  'site_photos', 'submittals', 'invoices', 'drawings', 'other',
] as const;

interface WorkspaceFileTokenPayload {
  workspaceId: string;
  uploaderId: string;
  category: string;
  clientId: string | null;
  projectId: string | null;
  dealId: string | null;
  latitude: number | null;
  longitude: number | null;
  takenAt: string | null;
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
        // clientPayload is whatever the browser passed to upload()
        // alongside the file. We expect a JSON string of our token
        // shape.
        if (!clientPayload) {
          throw new Error('Missing client payload');
        }
        const meta = JSON.parse(clientPayload) as Partial<WorkspaceFileTokenPayload>;
        if (!meta.workspaceId) throw new Error('workspaceId required');
        if (!meta.category) throw new Error('category required');
        if (!(ALLOWED_CATEGORIES as readonly string[]).includes(meta.category)) {
          throw new Error(`Invalid category: ${meta.category}`);
        }
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
        if (!tokenPayload) return;
        const meta = JSON.parse(tokenPayload) as WorkspaceFileTokenPayload;
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
            url: blob.url,
            filename,
            mimeType: blob.contentType ?? 'application/octet-stream',
            size,
            kind: 'DOCUMENT',
            category: meta.category,
            clientId: meta.clientId || null,
            projectId: meta.projectId || null,
            dealId: meta.dealId || null,
            latitude: meta.latitude,
            longitude: meta.longitude,
            takenAt: meta.takenAt ? new Date(meta.takenAt) : null,
          },
        });
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 400 });
  }
}
