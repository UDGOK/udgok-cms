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
import { revalidatePath } from 'next/cache';
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
  // Optional linkage fields — empty string means "unlinked"
  clientId: string;
  projectId: string;
  dealId: string;
  // GPS — empty string means "not captured" (Geolocation denied, etc.)
  // All values arrive as strings because the browser JSON-stringifies
  // the whole clientPayload. We parse to numbers/null in onUploadCompleted.
  latitude: string;
  longitude: string;
  takenAt: string;
}

export async function POST(req: NextRequest) {
  // See the comment in app/api/files/upload/route.ts for why we
  // don't call auth() at the top of this handler.

  const body = (await req.json()) as HandleUploadBody;
  console.log('[files/upload] POST hit, body.type =', (body as { type?: string }).type);
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

        console.log('[files/upload] onBeforeGenerateToken: OK for category', meta.category, 'workspace', meta.workspaceId);

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
        console.log('[files/upload] onUploadCompleted FIRED for blob', blob.pathname, 'hasToken', !!tokenPayload, 'url', blob.url);
        if (!tokenPayload) {
          console.error('[handleUpload] onUploadCompleted called without tokenPayload');
          return;
        }
        try {
          const meta = JSON.parse(tokenPayload) as WorkspaceFileTokenPayload;
          console.log('[files/upload] meta decoded', { workspaceId: meta.workspaceId, uploaderId: meta.uploaderId, category: meta.category, clientId: meta.clientId, projectId: meta.projectId });
          const filename = blob.pathname.split('/').pop() ?? 'file';
          let size = 0;
          try {
            const head = await fetch(blob.url, { method: 'HEAD' });
            const cl = head.headers.get('content-length');
            if (cl) size = Number(cl);
          } catch {
            // best-effort
          }
          // Prisma Float fields need numbers, not strings. tokenPayload
          // is a JSON string from the browser, so lat/lng arrive as
          // strings (possibly empty). Parse them to numbers or null.
          const lat = meta.latitude && meta.latitude !== '' ? Number(meta.latitude) : null;
          const lng = meta.longitude && meta.longitude !== '' ? Number(meta.longitude) : null;
          // takenAt is an ISO string from the browser; Prisma DateTime
          // accepts that, but reject invalid values explicitly.
          let takenAt: Date | null = null;
          if (meta.takenAt && meta.takenAt !== '') {
            const d = new Date(meta.takenAt);
            if (!isNaN(d.getTime())) takenAt = d;
          }

          // Defensive upserts — if the Clerk webhook hasn't synced
          // the user or workspace yet (webhook delivery can lag a
          // few seconds behind sign-in), the FK on File.uploaderId
          // / File.workspaceId would otherwise fail and silently
          // drop the row. The webhooks remain the canonical sync
          // path; this is the belt-and-braces fallback so uploads
          // never silently fail.
          await prisma.user.upsert({
            where: { id: meta.uploaderId },
            create: {
              id: meta.uploaderId,
              email: `${meta.uploaderId}@unknown.udgok.com`,
              name: null,
            },
            update: {},
          });
          // Upsert the workspace too. The slug is set to the
          // workspaceId as a placeholder; the Clerk webhook will
          // overwrite it with the real slug once it fires.
          const ws = await prisma.workspace.upsert({
            where: { id: meta.workspaceId },
            create: {
              id: meta.workspaceId,
              slug: meta.workspaceId,
              name: 'Workspace',
            },
            update: {},
          });

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
              latitude: lat != null && isFinite(lat) ? lat : null,
              longitude: lng != null && isFinite(lng) ? lng : null,
              takenAt,
            },
          });

          console.log('[files/upload] File row CREATED for blob', blob.pathname, 'workspace', meta.workspaceId, 'category', meta.category);

          // Revalidate the workspace files page so the next request
          // re-renders with the new file even if the client doesn't
          // call router.refresh().
          revalidatePath(`/w/${ws.slug}/files`);
        } catch (err) {
          // Without this, a Prisma error here would silently lose
          // the row while the file is happily in Vercel Blob. Log
          // it so Vercel logs surface the problem. The blob
          // object has the URL — including it in the error so
          // an operator can find the orphan blob in the Vercel
          // dashboard and delete it after a failed create.
          console.error(
            '[handleUpload] onUploadCompleted failed:',
            err instanceof Error ? `${err.message}\n${err.stack}` : err,
            'blob.url:', blob.url,
            'blob.pathname:', blob.pathname,
          );
        }
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 400 });
  }
}
