'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

// =========================================
// TEAMS
// =========================================

const teamSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex code').optional(),
  icon: z.string().max(8).optional(),
});

export type CreateTeamState = { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined;

export async function createTeamAction(
  workspaceSlug: string,
  _prev: CreateTeamState,
  formData: FormData,
): Promise<CreateTeamState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const parsed = teamSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    color: formData.get('color') || undefined,
    icon: formData.get('icon') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const team = await prisma.team.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color ?? '#f06a2d',
      icon: parsed.data.icon ?? '👥',
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/team`);
  return { id: team.id };
}

export async function addTeamMemberAction(
  workspaceSlug: string,
  teamId: string,
  formData: FormData,
) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const userIdToAdd = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? 'MEMBER') === 'LEAD' ? 'LEAD' : 'MEMBER';
  if (!userIdToAdd) return { error: 'Missing userId' };

  // Verify both the team and the user are in this workspace
  const [team, member] = await Promise.all([
    prisma.team.findFirst({ where: { id: teamId, workspaceId: workspace.id }, select: { id: true } }),
    prisma.membership.findFirst({ where: { userId: userIdToAdd, workspaceId: workspace.id }, select: { id: true } }),
  ]);
  if (!team) return { error: 'Team not found' };
  if (!member) return { error: 'User is not a workspace member' };

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId: userIdToAdd } },
    update: { role },
    create: { teamId, userId: userIdToAdd, role },
  });

  revalidatePath(`/w/${workspaceSlug}/team`);
  return { ok: true };
}

export async function removeTeamMemberAction(
  workspaceSlug: string,
  teamId: string,
  formData: FormData,
) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const userIdToRemove = String(formData.get('userId') ?? '');
  if (!userIdToRemove) return { error: 'Missing userId' };

  await prisma.teamMember.deleteMany({
    where: { teamId, userId: userIdToRemove, team: { workspaceId: workspace.id } },
  });
  revalidatePath(`/w/${workspaceSlug}/team`);
  return { ok: true };
}

export async function deleteTeamAction(workspaceSlug: string, teamId: string) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN']);

  await prisma.team.deleteMany({ where: { id: teamId, workspaceId: workspace.id } });
  revalidatePath(`/w/${workspaceSlug}/team`);
  return { ok: true };
}
