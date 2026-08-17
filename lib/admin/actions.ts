'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { Plan } from '@prisma/client';
import { logActivity } from '@/lib/activity/log';

const setPlanSchema = z.object({
  workspaceId: z.string().min(1),
  plan: z.nativeEnum(Plan),
});

export type SetPlanState = { error?: string; ok?: boolean } | undefined;

/**
 * Master-admin-only: set the plan of any workspace. This is what lets
 * the platform owner grant Pro/Enterprise access to customers.
 *
 * SECURITY: This is gated to master admins only. The action verifies
 * the caller is in the MASTERS list before touching the database.
 */
export async function setWorkspacePlanAction(
  _prev: SetPlanState,
  formData: FormData,
): Promise<SetPlanState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  if (!(await isMasterAdmin(userId))) {
    return { error: 'Master admin access required' };
  }

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
      actorId: userId,
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

/**
 * Master-admin-only: promote a member to OWNER. Used when the platform
 * owner wants to grant full rights on a specific workspace.
 */
export async function promoteToOwnerAction(
  workspaceId: string,
  targetUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  if (!(await isMasterAdmin(userId))) {
    return { ok: false, error: 'Master admin access required' };
  }

  const membership = await prisma.membership.findFirst({
    where: { workspaceId, userId: targetUserId },
    include: { user: { select: { email: true } } },
  });
  if (!membership) return { ok: false, error: 'Membership not found' };

  await prisma.membership.update({
    where: { id: membership.id },
    data: { role: 'OWNER' },
  });

  return { ok: true };
}

/**
 * Master-admin-only: force-add any user to any workspace. Useful when
 * a customer lost access and the platform owner needs to restore it.
 */
export async function forceAddMemberAction(
  workspaceId: string,
  email: string,
  role: 'OWNER' | 'ADMIN' | 'PM' | 'ESTIMATOR' | 'FIELD' | 'MEMBER' = 'MEMBER',
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };
  if (!(await isMasterAdmin(userId))) {
    return { ok: false, error: 'Master admin access required' };
  }

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

  return { ok: true };
}
