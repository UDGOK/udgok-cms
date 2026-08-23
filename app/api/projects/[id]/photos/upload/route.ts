/**
 * Project photo upload route. Direct browser → Vercel Blob via
 * `handleUpload` token — bypasses the 4.5MB function body limit so
 * 50 MB iPhone camera shots upload cleanly, AND surfaces real
 * progress events to the user.
 *
 * Token payload (JSON-stringified) carries: projectId, folderId,
 * room, area, phase, caption, takenAt, latitude, longitude. The
 * browser POSTs the same shape so the metadata survives the
 * round trip.
 *
 * Flow:
 *   1. Browser calls POST → we return an upload token (auth +
 *      role check happens here inside onBeforeGenerateToken)
 *   2. Browser PUTs the file directly to Vercel Blob
 *   3. onUploadCompleted fires here → we create the ProjectPhoto
 *      row with the metadata from the token, then revalidate
 *      the photos page so the new file shows up on the next
 *      navigation.
 *
 * Why a separate route from `/api/files/upload`: photos have a
 * different row model (ProjectPhoto with phase/room/area/folder
 * instead of File with category) and a different role set
 * (FIELD can upload photos but not arbitrary file categories).
 * Mirroring the file-upload shape keeps the two paths easy
 * to reason about side-by-side.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { logActivity } from '@/lib/activity/log';
import { z } from '@/lib/validation';
import { PhotoPhase } from '@prisma/client';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — same cap as the original server action

// clientPayload shape — mirrors the formData fields that
// uploadProjectPhotoAction used to consume server-side. We
// validate it here (same as uploadSchema in lib/photos/actions.ts)
// so a stale or tampered payload fails fast. uploaderId is
// optional in the schema because the completion callback is
// server-to-server (no user cookie) and we can also fall
// back to "most recent photo's uploader" — see onUploadCompleted.
const clientPayloadSchema = z.object({
  projectId: z.string().min(1),
  folderId: z.string().optional().nullable(),
  room: z.string().max(80).optional().nullable(),
  area: z.string().max(80).optional().nullable(),
  phase: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : PhotoPhase.ROUGH_IN))
    .pipe(z.nativeEnum(PhotoPhase)),
  caption: z.string().max(500).optional().nullable(),
  takenAt: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  uploaderId: z.string().optional().nullable(),
});

interface ProjectPhotoTokenPayload {
  projectId: string;
  folderId: string;
  room: string;
  area: string;
  phase: PhotoPhase;
  caption: string;
  takenAt: string;
  latitude: string;
  longitude: string;
  uploaderId: string;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  // See the comment in app/api/files/upload/route.ts for why we
  // don't call auth() at the top of this handler. The completion
  // callback from Vercel is server-to-server with no user cookie,
  // so a top-level auth check would 401 it and onUploadCompleted
  // would never run. The auth + project lookup happen inside
  // onBeforeGenerateToken below.

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) {
          throw new Error('Missing client payload');
        }
        let raw: unknown;
        try {
          raw = JSON.parse(clientPayload);
        } catch {
          throw new Error('Invalid client payload (not JSON)');
        }
        const parsed = clientPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          throw new Error(
            'Invalid client payload: ' + (parsed.error.issues[0]?.message ?? 'unknown'),
          );
        }
        // The :id in the URL is the project we're uploading to.
        // The clientPayload also carries a projectId — they must
        // match. This prevents a tampered token from writing a
        // photo to a project the caller didn't specify in the URL.
        if (parsed.data.projectId !== ctx.params.id) {
          throw new Error('projectId mismatch with URL');
        }

        const { userId } = await auth();
        if (!userId) throw new Error('Not signed in');

        const project = await prisma.project.findUnique({
          where: { id: parsed.data.projectId },
          select: { id: true, workspaceId: true, name: true },
        });
        if (!project) throw new Error('Project not found');

        // FIELD is allowed for photos (the original action also
        // allowed FIELD). The role gate is the only difference
        // from the workspace-files route.
        await requireRole(project.workspaceId, [
          'OWNER',
          'ADMIN',
          'PM',
          'ESTIMATOR',
          'FIELD',
        ]);

        // If a folderId was supplied, sanity-check it belongs
        // to this project. The original action does the same.
        if (parsed.data.folderId) {
          const folder = await prisma.projectPhotoFolder.findUnique({
            where: { id: parsed.data.folderId },
            select: { id: true, projectId: true },
          });
          if (!folder || folder.projectId !== project.id) {
            throw new Error('Invalid folder');
          }
        }

        // Return the upload constraints. The browser reads
        // allowedContentTypes / maximumSizeInBytes to fail fast
        // before any bytes leave the device. The token payload
        // echoes the same JSON we got so onUploadCompleted can
        // re-parse it without trusting the URL.
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/heic',
            'image/webp',
            'image/gif',
            'application/octet-stream',
          ],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          console.error('[handleUpload] photos onUploadCompleted called without tokenPayload');
          return;
        }
        try {
          const raw = JSON.parse(tokenPayload);
          const parsed = clientPayloadSchema.safeParse(raw);
          if (!parsed.success) {
            console.error(
              '[handleUpload] photos onUploadCompleted: bad token payload',
              parsed.error.issues,
            );
            return;
          }
          const meta = parsed.data as ProjectPhotoTokenPayload;

          // Re-fetch the project so we have the authoritative
          // workspaceId (the URL :id is the project; the
          // token's projectId was already cross-checked in
          // onBeforeGenerateToken).
          const project = await prisma.project.findUnique({
            where: { id: meta.projectId },
            select: { id: true, workspaceId: true, name: true },
          });
          if (!project) {
            console.error(
              '[handleUpload] photos onUploadCompleted: project vanished',
              meta.projectId,
            );
            return;
          }

          // Best-effort size lookup. Vercel Blob's blob.size
          // is unreliable across versions; the canonical answer
          // is a HEAD on the public URL. We swallow failures —
          // the row is fine with size=0, and orphan-cleanup
          // uses content-length from the Vercel API anyway.
          let size = 0;
          try {
            const head = await fetch(blob.url, { method: 'HEAD' });
            const cl = head.headers.get('content-length');
            if (cl) size = Number(cl);
          } catch {
            // best-effort
          }

          // Parse the geo / date fields. tokenPayload is a
          // JSON string from the browser, so lat/lng arrive
          // as strings (possibly empty). Prisma Float/DateTime
          // need real numbers / Dates.
          const lat =
            meta.latitude && meta.latitude !== '' && isFinite(Number(meta.latitude))
              ? Number(meta.latitude)
              : null;
          const lng =
            meta.longitude && meta.longitude !== '' && isFinite(Number(meta.longitude))
              ? Number(meta.longitude)
              : null;
          let takenAt: Date | null = null;
          if (meta.takenAt && meta.takenAt !== '') {
            const d = new Date(meta.takenAt);
            if (!isNaN(d.getTime())) takenAt = d;
          }

          // Resolve uploaderId. The completion callback is
          // server-to-server (no user cookie), so auth() will
          // return null. The browser sent the userId in the
          // token step but the Vercel Blob client doesn't
          // surface it back to us here, so we read it from the
          // first available row: the most recent ProjectPhoto
          // for this project. If nothing exists yet, we
          // can't create a row with a valid uploaderId — we'd
          // violate the FK. In that extremely-cold case we
          // log + bail (we still have the file in Blob, an
          // orphan-cleanup sweep will pick it up).
          //
          // Note: the canonical path is for the client to
          // include uploaderId in the clientPayload. We do
          // that in the refactored component, and we honor
          // it below as the primary signal. This makes the
          // "look at the latest photo" fallback only relevant
          // if the client somehow forgot to send it.
          let uploaderId: string | null = null;
          if (typeof (raw as Record<string, unknown>).uploaderId === 'string') {
            const candidate = (raw as Record<string, unknown>).uploaderId as string;
            if (candidate.length > 0) uploaderId = candidate;
          }
          if (!uploaderId) {
            try {
              const a = await auth();
              uploaderId = a?.userId ?? null;
            } catch {
              // server-to-server callback — no user context
            }
          }
          if (!uploaderId) {
            const recent = await prisma.projectPhoto.findFirst({
              where: { projectId: project.id },
              orderBy: { createdAt: 'desc' },
              select: { uploaderId: true },
            });
            uploaderId = recent?.uploaderId ?? null;
          }
          if (!uploaderId) {
            console.error(
              '[handleUpload] photos onUploadCompleted: no uploaderId available, dropping row for blob',
              blob.pathname,
            );
            return;
          }

          // Defensive upserts — if the Clerk webhook hasn't
          // synced the user or workspace yet (webhook delivery
          // can lag a few seconds behind sign-in), the FK on
          // ProjectPhoto.uploaderId / ProjectPhoto.workspaceId
          // would otherwise fail and silently drop the row. The
          // webhooks remain the canonical sync path; this is the
          // belt-and-braces fallback so uploads never silently
          // fail. Mirrors the same pattern in
          // app/api/files/upload/route.ts.
          await prisma.user.upsert({
            where: { id: uploaderId },
            create: {
              id: uploaderId,
              email: `${uploaderId}@unknown.udgok.com`,
              name: null,
            },
            update: {},
          });

          // Defensive upsert — workspace. Mirrors app/api/files/upload/route.ts.
          const ws = await prisma.workspace.upsert({
            where: { id: project.workspaceId },
            create: {
              id: project.workspaceId,
              slug: project.workspaceId,
              name: 'Workspace',
            },
            update: {},
          });

          const filename = blob.pathname.split('/').pop() ?? 'photo';

          const record = await prisma.projectPhoto.create({
            data: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              uploaderId,
              folderId: meta.folderId || null,
              url: blob.url,
              filename,
              mimeType: blob.contentType ?? 'application/octet-stream',
              size,
              room: meta.room || null,
              area: meta.area || null,
              phase: meta.phase,
              caption: meta.caption || null,
              latitude: lat,
              longitude: lng,
              takenAt,
            },
            select: { id: true, url: true },
          });

          // Best-effort activity log. The original server
          // action also wraps this in try/catch so logging
          // never breaks the primary operation.
          try {
            await logActivity({
              workspaceId: project.workspaceId,
              actorId: uploaderId,
              action: 'created',
              entityType: 'project',
              entityId: project.id,
              entityName: project.name,
              details: `Uploaded a ${meta.phase === 'ROUGH_IN' ? 'rough-in' : 'final'} photo${meta.room ? ` (${meta.room})` : ''}`,
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[handleUpload] photos logActivity failed:', err);
          }

          // Revalidate the photos page so the next navigation
          // reflects the new row. The slug is just a placeholder
          // at this point — the webhooks will overwrite it with
          // the real slug. The revalidation target is the
          // workspace-scoped URL, which Clerk middleware will
          // resolve correctly.
          try {
            revalidatePath(`/w/${ws.slug}/projects/${project.id}`);
            revalidatePath(`/w/${ws.slug}/projects/${project.id}/photos`);
          } catch {
            // best-effort
          }

          // Attach the new row id to the blob object so the
          // client (if it inspects the result) can see it.
          // The @vercel/blob client doesn't surface this
          // back to the browser, but it's useful for log
          // correlation.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (blob as any).photoId = record.id;
        } catch (err) {
          // Without this, a Prisma error here would silently
          // lose the row while the file is happily in Vercel
          // Blob. Log it so Vercel logs surface the problem.
          // eslint-disable-next-line no-console
          console.error('[handleUpload] photos onUploadCompleted failed:', err);
        }
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 400 });
  }
}
