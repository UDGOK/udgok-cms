'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from './get-workspace';

const renameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  industry: z.string().max(80).optional(),
});

export type RenameWorkspaceState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

export async function renameWorkspaceAction(
  workspaceSlug: string,
  _prev: RenameWorkspaceState,
  formData: FormData,
): Promise<RenameWorkspaceState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN']);

  const parsed = renameSchema.safeParse({
    name: formData.get('name'),
    industry: formData.get('industry') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const oldName = workspace.name;
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      name: parsed.data.name,
      industry: parsed.data.industry || null,
    },
  });

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'updated',
    entityType: 'workspace',
    entityId: workspace.id,
    entityName: parsed.data.name,
    details: oldName !== parsed.data.name ? `Renamed from "${oldName}" to "${parsed.data.name}"` : 'Updated workspace details',
  });

  revalidatePath(`/w/${workspaceSlug}`);
  revalidatePath(`/w/${workspaceSlug}/settings`);
  return { ok: true };
}

export async function deleteWorkspaceAction(workspaceSlug: string) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER']);

  // Cascade-delete all memberships, then the workspace (Prisma onDelete: Cascade handles the rest)
  await prisma.membership.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });

  revalidatePath('/workspaces');
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['ADMIN', 'PM', 'ESTIMATOR', 'FIELD', 'MEMBER']).default('MEMBER'),
});

export type InviteMemberState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

/**
 * Invite a new member to the workspace. Creates a placeholder User row
 * (matched on email) and a Membership. The invited user will appear in
 * the team list immediately; when they sign up via Clerk with this
 * email, the webhook (if configured) upgrades the User row with their
 * Clerk ID.
 *
 * NOTE: This is a workspace-internal invite (not a Clerk Organization
 * invitation). For a full Clerk-backed invite flow that sends an email,
 * we'd use clerkClient.organizations.createOrganizationInvitation — that
 * needs a Clerk Organization backing the workspace, which we removed
 * earlier to avoid the Free plan limit. The current flow is the
 * minimal viable version: an email is recorded, the member shows up
 * in the team, and you can re-share the sign-up link with them.
 */
export async function inviteMemberAction(
  workspaceSlug: string,
  _prev: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN']);

  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role') || 'MEMBER',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Create or get the user (idempotent on email)
  const user = await prisma.user.upsert({
    where: { email: parsed.data.email },
    update: {},
    create: {
      id: `pending_${Math.random().toString(36).slice(2, 12)}`,
      email: parsed.data.email,
    },
  });

  // Check if already a member
  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
  });
  if (existing) return { error: 'That person is already a member of this workspace.' };

  await prisma.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: parsed.data.role,
    },
  });

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'invited',
    entityType: 'member',
    entityId: user.id,
    entityName: parsed.data.email,
    details: `Invited as ${parsed.data.role}`,
  });

  revalidatePath(`/w/${workspaceSlug}/team`);
  revalidatePath(`/w/${workspaceSlug}/settings`);
  return { ok: true };
}
