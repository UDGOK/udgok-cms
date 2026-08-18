'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { Plan, Role } from '@prisma/client';
import { logActivity } from '@/lib/activity/log';

// =========================================
// HELPERS
// =========================================

/**
 * Standard guard: returns the master admin's userId, or an error string.
 * Use at the top of every action so we never miss a check.
 */
async function guard(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  if (!(await isMasterAdmin(userId))) {
    return { ok: false, error: 'Master admin access required' };
  }
  return { ok: true, userId };
}

// =========================================
// WORKSPACE PLAN
// =========================================

const setPlanSchema = z.object({
  workspaceId: z.string().min(1),
  plan: z.nativeEnum(Plan),
});

export type SetPlanState = { error?: string; ok?: boolean } | undefined;

export async function setWorkspacePlanAction(
  _prev: SetPlanState,
  formData: FormData,
): Promise<SetPlanState> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const parsed = setPlanSchema.safeParse({
    workspaceId: formData.get('workspaceId'),
    plan: formData.get('plan'),
  });
  if (!parsed.success) return { error: 'Invalid input' };

  const before = await prisma.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { plan: true, name: true, slug: true },
  });
  if (!before) return { error: 'Workspace not found' };

  await prisma.workspace.update({
    where: { id: parsed.data.workspaceId },
    data: { plan: parsed.data.plan },
  });

  try {
    await logActivity({
      workspaceId: parsed.data.workspaceId,
      actorId: g.userId,
      action: 'updated',
      entityType: 'workspace',
      entityId: parsed.data.workspaceId,
      entityName: before.name,
      details: `Plan changed from ${before.plan} to ${parsed.data.plan}`,
      metadata: { before: before.plan, after: parsed.data.plan },
    });
  } catch {
    // noop
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
  revalidatePath(`/w/${before.slug}/settings`);
  return { ok: true };
}

// =========================================
// WORKSPACE EDIT (name, slug, industry)
// =========================================

const editWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  industry: z.string().max(60).optional(),
});

export type EditWorkspaceState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

export async function editWorkspaceAction(
  _prev: EditWorkspaceState,
  formData: FormData,
): Promise<EditWorkspaceState> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const parsed = editWorkspaceSchema.safeParse({
    workspaceId: formData.get('workspaceId'),
    name: formData.get('name'),
    slug: formData.get('slug'),
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

  const existing = await prisma.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { id: true, slug: true },
  });
  if (!existing) return { error: 'Workspace not found' };

  // Slug collision check
  if (parsed.data.slug !== existing.slug) {
    const collision = await prisma.workspace.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (collision) {
      return { error: 'That slug is already in use', fieldErrors: { slug: 'Slug already in use' } };
    }
  }

  await prisma.workspace.update({
    where: { id: parsed.data.workspaceId },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      industry: parsed.data.industry,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/workspaces');
  revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
  revalidatePath(`/w/${parsed.data.slug}/settings`);
  revalidatePath(`/w/${existing.slug}/settings`);
  return { ok: true };
}

// =========================================
// WORKSPACE DELETE (cascade)
// =========================================

/**
 * Hard-delete a workspace and ALL of its data. The action itself
 * returns {ok, error} and does NOT redirect — the client component
 * handles the redirect using window.location for maximum reliability.
 *
 * Uses an explicit transaction with deleteMany calls in dependency
 * order. Wrapped in try/catch so failures return a human-readable
 * error instead of a 500.
 *
 * Cascade strategy:
 *  - Workspace → cascade to most tables (via schema)
 *  - Membership.user → NoAction (don't delete users; they may
 *    belong to other workspaces)
 *  - Task.assignee → SetNull (nullable FK, author stays)
 *  - Task.createdBy → NoAction (task belongs to workspace)
 *  - File.uploader / Note.author → NoAction (preserve users)
 *  - ProjectDivisionAssignment → cascade via division + assignment
 */
export async function deleteWorkspaceAction(
  workspaceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, name: true },
  });
  if (!ws) return { ok: false, error: 'Workspace not found' };

  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: workspace-scoped leaf tables (most dependencies first)
      await tx.activityLog.deleteMany({ where: { workspaceId } });
      await tx.message.deleteMany({ where: { workspaceId } });
      await tx.file.deleteMany({ where: { workspaceId } });
      await tx.task.deleteMany({ where: { workspaceId } });
      await tx.deal.deleteMany({ where: { workspaceId } });
      await tx.client.deleteMany({ where: { workspaceId } });
      await tx.subcontractor.deleteMany({ where: { workspaceId } });

      // Step 2: project-scoped tables
      // Inspections before permits (FK: permit → workspace cascade)
      await tx.inspection.deleteMany({ where: { workspaceId } });
      await tx.permit.deleteMany({ where: { workspaceId } });
      // Divisions cascade through assignments → divisionAssignments
      await tx.projectDivisionAssignment.deleteMany({
        where: { assignment: { project: { workspaceId } } },
      });
      await tx.projectSubcontractorAssignment.deleteMany({
        where: { project: { workspaceId } },
      });
      await tx.projectDivision.deleteMany({
        where: { project: { workspaceId } },
      });
      await tx.payApp.deleteMany({ where: { project: { workspaceId } } });
      await tx.projectPhoto.deleteMany({ where: { project: { workspaceId } } });
      await tx.projectPhotoFolder.deleteMany({ where: { project: { workspaceId } } });
      await tx.projectMember.deleteMany({ where: { project: { workspaceId } } });
      await tx.project.deleteMany({ where: { workspaceId } });

      // Step 3: workspace-scoped tables
      await tx.teamMember.deleteMany({ where: { team: { workspaceId } } });
      await tx.team.deleteMany({ where: { workspaceId } });

      // Step 4: membership (user stays, only the membership row goes)
      await tx.membership.deleteMany({ where: { workspaceId } });

      // Step 5: the workspace itself
      await tx.workspace.delete({ where: { id: workspaceId } });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteWorkspaceAction] transaction failed:', msg);
    return { ok: false, error: `Delete failed: ${msg}` };
  }

  // Invalidate Next.js cache for affected paths
  revalidatePath('/admin');
  revalidatePath('/admin/workspaces');
  revalidatePath(`/w/${ws.slug}`);

  return { ok: true };
}

// =========================================
// MEMBERSHIP MANAGEMENT
// =========================================

export async function promoteToOwnerAction(
  workspaceId: string,
  targetUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const membership = await prisma.membership.findFirst({
    where: { workspaceId, userId: targetUserId },
  });
  if (!membership) return { ok: false, error: 'Membership not found' };

  await prisma.membership.update({
    where: { id: membership.id },
    data: { role: 'OWNER' },
  });

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { ok: true };
}

const changeRoleSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: z.nativeEnum(Role),
});

export async function changeMemberRoleAction(
  workspaceId: string,
  userId: string,
  role: Role,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };
  const parsed = changeRoleSchema.safeParse({ workspaceId, userId, role });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await prisma.membership.updateMany({
    where: { workspaceId, userId },
    data: { role: parsed.data.role },
  });
  if (result.count === 0) return { ok: false, error: 'Membership not found' };

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath(`/w/${workspaceId}/team`);
  return { ok: true };
}

export async function removeMemberAction(
  workspaceId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  await prisma.membership.deleteMany({
    where: { workspaceId, userId },
  });

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { ok: true };
}

export async function forceAddMemberAction(
  workspaceId: string,
  email: string,
  role: Role = 'MEMBER',
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) return { ok: false, error: 'No user with that email' };

  const existing = await prisma.membership.findFirst({
    where: { workspaceId, userId: targetUser.id },
  });
  if (existing) {
    await prisma.membership.update({
      where: { id: existing.id },
      data: { role },
    });
  } else {
    await prisma.membership.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role,
      },
    });
  }

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { ok: true };
}

// =========================================
// USER MANAGEMENT
// =========================================

/**
 * Hard-delete a user. They will be removed from every workspace.
 * The Clerk account is NOT deleted (you do that in the Clerk dashboard)
 * — we only drop our local record of them.
 */
export async function deleteUserAction(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  // Prevent deleting yourself
  if (userId === g.userId) {
    return { ok: false, error: 'You cannot delete your own account' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return { ok: false, error: 'User not found' };

  // Don't allow deleting a master admin
  if ((await isMasterAdmin(userId))) {
    return { ok: false, error: 'Cannot delete a master admin' };
  }

  await prisma.user.delete({ where: { id: userId } });

  revalidatePath('/admin');
  revalidatePath('/admin/users');
  return { ok: true };
}

/**
 * Remove a user from every workspace they belong to (but keep the user
 * record + their Clerk account). Useful for kicking a customer.
 */
export async function removeUserFromAllWorkspacesAction(
  userId: string,
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const result = await prisma.membership.deleteMany({ where: { userId } });

  revalidatePath('/admin');
  revalidatePath('/admin/users');
  return { ok: true, count: result.count };
}

// =========================================
// PROJECT MANAGEMENT (admin override)
// =========================================

export async function deleteProjectAction(
  workspaceId: string,
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  // Verify project belongs to the workspace (so a master admin can't
  // delete a project from a different workspace by mistake)
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true, workspace: { select: { slug: true } } },
  });
  if (!project) return { ok: false, error: 'Project not found' };

  try {
    await prisma.$transaction(async (tx) => {
      // Delete project-scoped tables explicitly to avoid FK violations
      // when schema cascades don't reach deep enough.
      await tx.payApp.deleteMany({ where: { projectId } });
      await tx.projectPhoto.deleteMany({ where: { projectId } });
      await tx.projectPhotoFolder.deleteMany({ where: { projectId } });
      await tx.projectMember.deleteMany({ where: { projectId } });
      await tx.permit.deleteMany({ where: { projectId } });
      await tx.inspection.deleteMany({ where: { permit: { projectId } } });
      await tx.projectDivisionAssignment.deleteMany({
        where: { assignment: { projectId } },
      });
      await tx.projectSubcontractorAssignment.deleteMany({ where: { projectId } });
      await tx.projectDivision.deleteMany({ where: { projectId } });
      // Then the project itself
      await tx.project.delete({ where: { id: projectId } });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteProjectAction] transaction failed:', msg);
    return { ok: false, error: `Delete failed: ${msg}` };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/projects');
  revalidatePath(`/w/${project.workspace.slug}/projects`);
  return { ok: true };
}

// =========================================
// PAY APP MANAGEMENT
// =========================================

export async function deletePayAppAction(
  workspaceId: string,
  payAppId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const payApp = await prisma.payApp.findFirst({
    where: { id: payAppId, project: { workspaceId } },
    select: { id: true },
  });
  if (!payApp) return { ok: false, error: 'Pay app not found' };

  await prisma.payApp.delete({ where: { id: payAppId } });
  revalidatePath('/admin');
  revalidatePath(`/w/${workspaceId}/projects`);
  return { ok: true };
}

// =========================================
// CLIENT MANAGEMENT
// =========================================

export async function deleteClientAction(
  workspaceId: string,
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true },
  });
  if (!client) return { ok: false, error: 'Client not found' };

  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath('/admin');
  revalidatePath(`/w/${workspaceId}/clients`);
  return { ok: true };
}

// =========================================
// IMPERSONATION
// =========================================

/**
 * Mark the current user as impersonating a target workspace.
 * The audit log captures who did what during impersonation. We don't
 * use a separate session — we just set a cookie that the app reads
 * to display a "Viewing as" banner. Actual data access still uses
 * the master admin's own userId.
 */
export async function startImpersonationAction(
  workspaceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };
  // No actual state change needed — caller will set the cookie.
  // Just verify the workspace exists.
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!ws) return { ok: false, error: 'Workspace not found' };
  return { ok: true };
}
