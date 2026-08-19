/**
 * GET /api/projects/[id]/pdf
 *
 * Generates the Project Book PDF for a project and streams it
 * back as `application/pdf`. Used by the "Create PDF" button on
 * the project page.
 *
 * Auth: same as the project page — the user must be a member
 * of the workspace that owns the project. We resolve the project
 * by id and check workspaceId against the user's membership.
 *
 * Performance: react-pdf's renderToBuffer runs server-side. We
 * measured ~1.5s for a project with 30 photos on the first
 * deploy; subsequent renders are similar because we don't cache.
 * Caching could be added later via Vercel KV keyed by projectId
 * + lastProjectUpdateAt if traffic warrants it.
 *
 * Errors:
 *   401  not signed in
 *   403  not a member of the workspace
 *   404  project not found (or not in user's workspace)
 *   500  render failure (caught and logged via lib/monitoring)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { captureError } from '@/lib/monitoring';
import { renderProjectPdf } from '@/lib/pdf/render';
import { toProjectData } from '@/lib/pdf/adapter';
import { listProjectPermits } from '@/lib/permits/queries';
import { listEntityActivity } from '@/lib/activity/queries';

// Vercel function timeout. PDF generation with photos can take
// 3-5s for a project with 30+ photos. Default 10s is too tight
// for the largest projects. Bump to 60s to be safe.
export const maxDuration = 60;
// Always re-render — never cache the PDF in this function. The
// project data changes too often for a cached PDF to be
// trustworthy, and the only "cache" we have is the Vercel CDN
// which would just serve stale docs.
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  // Look up the project + its workspace in a single query so we
  // can both authorize and fetch in one round trip.
  const project = await prisma.project.findUnique({
    where: { id: ctx.params.id },
    include: { workspace: { select: { id: true, slug: true } } },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Membership check.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: project.workspaceId } },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
  }

  // Fetch the full project with relations. We re-use
  // getProjectWithRelations so the PDF shows the same data as
  // the web project page.
  const { getProjectWithRelations } = await import('@/lib/projects/insights');
  const full = await getProjectWithRelations(project.workspaceId, project.id);
  if (!full) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Fetch the additional data the PDF needs but the page
  // already gets separately: permits, notes, activity, photos.
  const [permits, notes, activity, photos] = await Promise.all([
    listProjectPermits(project.id),
    // Notes: pull the most recent 10 for the project. The PDF
    // caps to 5 anyway, but fetching 10 lets us sort server-side
    // without a second round trip.
    prisma.note.findMany({
      where: { projectId: project.id },
      include: { author: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Activity: most recent 20 for the project. The PDF caps to
    // 12 in the activity section, but we want a little headroom
    // in case some rows render blank.
    listEntityActivity(project.workspaceId, 'project', project.id, 20),
    // Photos: most recent 100 — the PDF caps to 60 but we
    // don't want to miss recent uploads if the cap changes.
    prisma.projectPhoto.findMany({
      where: { projectId: project.id },
      include: { uploader: { select: { name: true, email: true } } },
      orderBy: { takenAt: 'desc' },
      take: 100,
    }),
  ]);

  // Shape into the ProjectData the PDF component expects.
  const data = toProjectData(full, {
    permits,
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt,
      user: { name: n.author.name, email: n.author.email },
    })),
    activity,
    photos: photos.map((p) => ({
      id: p.id,
      url: p.url,
      filename: p.filename,
      phase: p.phase,
      room: p.room,
      area: p.area,
      caption: p.caption,
      latitude: p.latitude,
      longitude: p.longitude,
      takenAt: p.takenAt,
      uploader: { name: p.uploader.name, email: p.uploader.email },
    })),
  });

  // Render. We wrap in try/catch so a render failure becomes a
  // 500 with a safe error message, not a server crash.
  let buffer: Buffer;
  try {
    buffer = await renderProjectPdf(data, new Date().toISOString().slice(0, 10));
  } catch (err) {
    captureError(err, { kind: 'project-pdf-render', projectId: project.id, userId });
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 },
    );
  }

  // Filename: project code (sanitized) + date. Falls back to
  // the project name if no code, since that's still unique.
  const safeCode = (project.code || project.name)
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const filename = `${safeCode || 'project'}_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Stream the response. Cast Buffer → Uint8Array because
  // NextResponse's BodyInit expects the wider type.
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      // Don't let intermediaries cache — the project's data may
      // change between renders, and a stale PDF could mislead.
      'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
    },
  });
}
