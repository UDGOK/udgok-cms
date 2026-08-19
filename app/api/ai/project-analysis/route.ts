import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getProjectWithRelations, type ProjectMeta } from '@/lib/projects/insights';
import { analyzeProjectDeep, generateDeepInsights } from '@/lib/ai/project-analyzer';
import { isOpenRouterConfigured } from '@/lib/ai/openrouter';

export const dynamic = 'force-dynamic';
// Generous timeout — the AI model can take up to 60s for a full project
// analysis (especially on first cold start). Vercel serverless allows up
// to 60s on the free tier, more on pro.
export const maxDuration = 60;

/**
 * POST /api/ai/project-analysis
 * Body: { projectId }
 *
 * Returns the DeepSeek/NVIDIA executive summary + deep insights for a
 * project. Auth: user must be a workspace member (or master admin).
 *
 * Why a route handler instead of a server action: the project page
 * renders the rule-based insights immediately (fast, local) and then
 * fires this API on the client. The page never blocks on the AI call.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  const body = (await req.json()) as { projectId?: string };
  if (!body.projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  // Load the project + verify access
  const project = await prisma.project.findFirst({
    where: { id: body.projectId },
    select: {
      id: true,
      workspaceId: true,
      workspace: {
        select: {
          id: true,
          slug: true,
          members: { where: { userId }, select: { id: true } },
        },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Auth: workspace member or master admin
  const { isMasterAdmin } = await import('@/lib/admin/permissions');
  const master = await isMasterAdmin(userId);
  if (!master && project.workspace.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Build the same ProjectMeta shape the server-component path used.
    // The function returns the data the AI board needs.
    const fullProject = await getProjectWithRelations(project.workspaceId, project.id);
    if (!fullProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Cast Decimal -> number (Prisma's getProjectWithRelations returns
    // raw Decimal fields; ProjectMeta expects numbers)
    const meta = {
      ...fullProject,
      contractValue: fullProject.contractValue ? Number(fullProject.contractValue) : null,
      divisions: fullProject.divisions.map((d) => ({
        ...d,
        budget: Number(d.budget),
        payAppLines: d.payAppLines.map((l) => ({
          thisDrawAmount: Number(l.thisDrawAmount),
        })),
      })),
      payApps: fullProject.payApps.map((p) => ({
        ...p,
        totalThisDraw: Number(p.totalThisDraw),
        totalContract: Number(p.totalContract),
        totalPrevious: Number(p.totalPrevious),
        divisions: p.divisions.map((d) => ({
          projectDivisionId: d.projectDivisionId,
          thisDrawAmount: Number(d.thisDrawAmount),
        })),
      })),
    } as unknown as ProjectMeta;

    // Run the two AI calls in parallel
    const [deepAnalysis, deepInsights] = await Promise.all([
      analyzeProjectDeep(meta, project.workspace.slug, project.id),
      generateDeepInsights(meta, project.workspace.slug, project.id),
    ]);

    return NextResponse.json({
      deepAnalysis,
      deepInsights,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AI project-analysis] failed:', msg);
    return NextResponse.json(
      { error: 'AI analysis failed', detail: msg },
      { status: 500 },
    );
  }
}
