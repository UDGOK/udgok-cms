'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from './get-workspace';

/**
 * Export the entire workspace as a JSON document. Includes all
 * business data but excludes membership/user data (those are
 * managed by Clerk and shouldn't be backed up alongside business data).
 */
export async function exportWorkspaceAction(workspaceSlug: string) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in', data: null };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN']);

  const [clients, projects, teams, subs] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: workspace.id },
      include: { properties: true, notes: true, deals: { include: { notes: true } } },
    }),
    prisma.project.findMany({
      where: { workspaceId: workspace.id },
      include: {
        divisions: true,
        payApps: { include: { divisions: true, viewEvents: true } },
        tasks: true,
        notes: true,
        subAssignments: { include: { divisionLinks: { include: { division: true } } } },
      },
    }),
    prisma.team.findMany({
      where: { workspaceId: workspace.id },
      include: { members: true },
    }),
    prisma.subcontractor.findMany({
      where: { workspaceId: workspace.id },
      include: { assignments: { include: { divisionLinks: { include: { division: true } } } } },
    }),
  ]);

  const data = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    workspace: {
      name: workspace.name,
      slug: workspace.slug,
      industry: workspace.industry,
    },
    counts: {
      clients: clients.length,
      projects: projects.length,
      divisions: projects.reduce((acc, p) => acc + p.divisions.length, 0),
      payApps: projects.reduce((acc, p) => acc + p.payApps.length, 0),
      tasks: projects.reduce((acc, p) => acc + p.tasks.length, 0),
      teams: teams.length,
      subs: subs.length,
    },
    clients,
    projects,
    teams,
    subs,
  };

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'exported',
    entityType: 'workspace',
    entityId: workspace.id,
    entityName: workspace.name,
    details: `Exported ${data.counts.clients} clients, ${data.counts.projects} projects, ${data.counts.payApps} pay apps`,
  });

  return { ok: true, data };
}

const importSchema = z.object({
  json: z.string().min(2),
  mode: z.enum(['merge', 'replace']).default('merge'),
});

export type ImportState = { error?: string; imported?: { clients: number; projects: number; payApps: number }; ok?: boolean } | undefined;

/**
 * Import workspace data from a JSON export. Supports two modes:
 * - merge: add new records, skip ones that already exist (matched by name)
 * - replace: clear existing data first, then import (DESTRUCTIVE)
 */
export async function importWorkspaceAction(
  workspaceSlug: string,
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER']);

  const parsed = importSchema.safeParse({
    json: formData.get('json'),
    mode: formData.get('mode') || 'merge',
  });
  if (!parsed.success) {
    return { error: 'Invalid input' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try {
    payload = JSON.parse(parsed.data.json);
  } catch {
    return { error: 'Invalid JSON' };
  }
  if (!payload || payload.schemaVersion !== 1) {
    return { error: 'Unsupported export version' };
  }

  const mode = parsed.data.mode;
  let importedClients = 0;
  let importedProjects = 0;
  let importedPayApps = 0;

  // Replace mode: clear existing business data (DESTRUCTIVE)
  if (mode === 'replace') {
    await prisma.$transaction([
      prisma.payAppViewEvent.deleteMany({ where: { payApp: { project: { workspaceId: workspace.id } } } }),
      prisma.payAppDivision.deleteMany({ where: { payApp: { project: { workspaceId: workspace.id } } } }),
      prisma.payApp.deleteMany({ where: { project: { workspaceId: workspace.id } } }),
      prisma.projectDivisionAssignment.deleteMany({ where: { assignment: { project: { workspaceId: workspace.id } } } }),
      prisma.projectSubcontractorAssignment.deleteMany({ where: { project: { workspaceId: workspace.id } } }),
      prisma.projectDivision.deleteMany({ where: { project: { workspaceId: workspace.id } } }),
      prisma.projectMember.deleteMany({ where: { project: { workspaceId: workspace.id } } }),
      prisma.task.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.file.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.note.deleteMany({ where: { project: { workspaceId: workspace.id } } }),
      prisma.note.deleteMany({ where: { deal: { workspaceId: workspace.id } } }),
      prisma.project.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.deal.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.property.deleteMany({ where: { client: { workspaceId: workspace.id } } }),
      prisma.note.deleteMany({ where: { client: { workspaceId: workspace.id } } }),
      prisma.client.deleteMany({ where: { workspaceId: workspace.id } }),
    ]);
  }

  for (const c of payload.clients ?? []) {
    const existing = await prisma.client.findFirst({ where: { workspaceId: workspace.id, name: c.name } });
    if (existing && mode === 'merge') continue;
    await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        type: c.type,
        status: c.status,
        source: c.source,
      },
    });
    importedClients++;
  }

  for (const p of payload.projects ?? []) {
    const existing = await prisma.project.findFirst({ where: { workspaceId: workspace.id, name: p.name } });
    if (existing && mode === 'merge') continue;
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: p.name,
        code: p.code,
        description: p.description,
        status: p.status,
        startDate: p.startDate ? new Date(p.startDate) : null,
        endDate: p.endDate ? new Date(p.endDate) : null,
        contractValue: p.contractValue,
      },
    });
    importedProjects++;
    for (const d of p.divisions ?? []) {
      await prisma.projectDivision.create({
        data: {
          projectId: project.id,
          code: d.code,
          trade: d.trade,
          subcontractorName: d.subcontractorName,
          budget: d.budget,
          sortOrder: d.sortOrder,
        },
      });
    }
    importedPayApps += (p.payApps ?? []).length;
  }

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'imported',
    entityType: 'workspace',
    entityId: workspace.id,
    entityName: workspace.name,
    details: `Imported ${importedClients} clients, ${importedProjects} projects, ${importedPayApps} pay apps (mode: ${mode})`,
  });

  revalidatePath(`/w/${workspaceSlug}`);
  return {
    ok: true,
    imported: { clients: importedClients, projects: importedProjects, payApps: importedPayApps },
  };
}
