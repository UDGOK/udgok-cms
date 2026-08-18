/**
 * BIM/IFC upload route for a project.
 *
 * Files are big (up to 500MB), so we use the Vercel Blob client-side
 * upload() with a handleUpload token pattern. The browser uploads
 * DIRECTLY to Vercel Blob, bypassing the 4.5MB function body limit.
 *
 * Flow:
 *   1. Client calls POST /api/projects/[id]/bim?filename=...
 *      - We check auth + role + extension + create a token
 *      - Client gets back {url, token}
 *   2. Client calls blob.upload({url, token, file}) — direct to Blob
 *   3. Client calls POST /api/projects/[id]/bim/complete with the
 *      blob URL — we create the BimModel row
 *
 * The takeoff service then downloads the IFC by URL and runs the
 * extraction. (BimModel.url is the blob URL.)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_EXTENSIONS = ['.ifc'];

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  // See app/api/files/upload/route.ts for why we don't call auth()
  // and the project lookup at the top of the handler. The completion
  // callback from Vercel is server-to-server with no user cookie,
  // so a top-level auth check would 401 it and onUploadCompleted
  // would never run. The auth + project lookup happen inside
  // onBeforeGenerateToken below.

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Auth + project lookup live INSIDE onBeforeGenerateToken,
        // not at the top of the handler. The completion callback
        // (which is a separate POST from Vercel, no user cookie)
        // doesn't need either check.
        const { userId } = await auth();
        if (!userId) throw new Error('Not signed in');
        const project = await prisma.project.findFirst({
          where: { id: ctx.params.id },
          select: { id: true, workspaceId: true },
        });
        if (!project) throw new Error('Project not found');
        await requireRole(project.workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

        const ext = pathname.toLowerCase().slice(pathname.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new Error(`Only ${ALLOWED_EXTENSIONS.join(', ')} files are accepted`);
        }
        return {
          // Path under the workspace — keeps blob organization clean
          // and makes orphan cleanup easy.
          allowedContentTypes: ['application/x-step', 'application/octet-stream'],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            projectId: project.id,
            workspaceId: project.workspaceId,
            uploaderId: userId,
            pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          console.error('[handleUpload] onUploadCompleted called without tokenPayload');
          return;
        }
        try {
          const meta = JSON.parse(tokenPayload) as {
            projectId: string;
            workspaceId: string;
            uploaderId: string;
            pathname: string;
          };
          // Filename recovery: pathname might be "model.ifc" or "x-y-z.ifc"
          // because of addRandomSuffix. We just use the blob's pathname.
          const filename = blob.pathname.split('/').pop() ?? 'model.ifc';
          // Fetch the blob to get its size (blob has a contentLength too
          // but it's not always populated by handleUpload; we fetch).
          let size = 0;
          try {
            const head = await fetch(blob.url, { method: 'HEAD' });
            const cl = head.headers.get('content-length');
            if (cl) size = Number(cl);
          } catch {
            // best-effort
          }
          await prisma.bimModel.create({
            data: {
              projectId: meta.projectId,
              workspaceId: meta.workspaceId,
            uploaderId: meta.uploaderId,
            url: blob.url,
            filename,
            size,
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
