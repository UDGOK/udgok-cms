'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PROPERTY_MANAGER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  source: z.string().max(80).optional(),
});

export type CreateClientState = { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined;
export type UpdateClientState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

export async function createClientAction(
  workspaceSlug: string,
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = clientSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    type: formData.get('type') || undefined,
    status: formData.get('status') || undefined,
    source: formData.get('source') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      type: parsed.data.type ?? 'RESIDENTIAL',
      status: parsed.data.status ?? 'ACTIVE',
      source: parsed.data.source,
    },
    select: { id: true, name: true },
  });

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'created',
    entityType: 'client',
    entityId: client.id,
    entityName: client.name,
    details: `Added client`,
  });

  revalidatePath(`/w/${workspaceSlug}/clients`);
  return { id: client.id };
}

export async function updateClientAction(
  workspaceSlug: string,
  clientId: string,
  _prev: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = clientSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    type: formData.get('type') || undefined,
    status: formData.get('status') || undefined,
    source: formData.get('source') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!existing) return { error: 'Client not found' };

  await prisma.client.update({
    where: { id: clientId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      type: parsed.data.type,
      status: parsed.data.status,
      source: parsed.data.source,
    },
  });

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'updated',
    entityType: 'client',
    entityId: clientId,
    entityName: parsed.data.name,
    details: `Updated client details`,
  });

  revalidatePath(`/w/${workspaceSlug}/clients`);
  revalidatePath(`/w/${workspaceSlug}/clients/${clientId}`);
  return { ok: true };
}

export async function deleteClientAction(workspaceSlug: string, clientId: string) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN']);

  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
    select: { id: true, name: true, _count: { select: { projects: true, deals: true, notes: true } } },
  });
  if (!existing) return { error: 'Client not found' };

  // Soft check: if there are projects, warn (but allow force delete if user really wants)
  await prisma.client.delete({ where: { id: clientId } });

  const { logActivity } = await import('@/lib/activity/log');
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'deleted',
    entityType: 'client',
    entityId: clientId,
    entityName: existing.name,
    details: `Removed client${existing._count.projects ? ` and ${existing._count.projects} project(s)` : ''}`,
  });

  revalidatePath(`/w/${workspaceSlug}/clients`);
  return { ok: true };
}
