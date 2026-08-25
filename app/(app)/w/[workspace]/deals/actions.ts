'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { DEAL_STAGES, type DealStage } from '@/lib/deals/queries';
import type { DealStage as PrismaDealStage } from '@prisma/client';

const createDealSchema = z.object({
  clientId: z.string().min(1),
  propertyId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200),
  value: z.coerce.number().min(0).default(0),
  margin: z.coerce.number().min(0).max(100).optional(),
  expectedClose: z.string().optional(),
  description: z.string().max(4000).optional(),
});

export type CreateDealState =
  | { error?: string; fieldErrors?: Record<string, string>; id?: string }
  | undefined;

export async function createDealAction(
  workspaceSlug: string,
  _prev: CreateDealState,
  formData: FormData,
): Promise<CreateDealState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = createDealSchema.safeParse({
    clientId: formData.get('clientId'),
    propertyId: formData.get('propertyId') || null,
    title: formData.get('title'),
    value: formData.get('value') ?? 0,
    margin: formData.get('margin') || undefined,
    expectedClose: formData.get('expectedClose') || undefined,
    description: formData.get('description') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: workspace.id },
  });
  if (!client) return { error: 'Client not found' };

  const deal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id,
      clientId: parsed.data.clientId,
      propertyId: parsed.data.propertyId ?? null,
      title: parsed.data.title,
      value: parsed.data.value,
      margin: parsed.data.margin ?? null,
      stage: 'LEAD' as PrismaDealStage,
      expectedClose: parsed.data.expectedClose ? new Date(parsed.data.expectedClose) : null,
      description: parsed.data.description || null,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/deals`);
  return { id: deal.id };
}

export async function moveDealStage(dealId: string, newStage: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { workspaceId: true } });
  if (!deal) return { error: 'Deal not found' };
  await requireRole(deal.workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);
  if (!DEAL_STAGES.includes(newStage as DealStage)) {
    return { error: 'Invalid stage' };
  }
  await prisma.deal.update({
    where: { id: dealId },
    data: { stage: newStage as PrismaDealStage },
  });
  revalidatePath('/w');
  return { ok: true };
}


const updateDealSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  value: z.coerce.number().min(0).default(0),
  margin: z.coerce.number().min(0).max(100).optional(),
  expectedClose: z.string().optional(),
  description: z.string().max(4000).optional(),
  propertyId: z.string().optional().nullable(),
});

export type UpdateDealState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

/**
 * Update a deal. Same permission set as create — anyone who can
 * originate a deal can edit it. Returns ok on success so the
 * modal can close itself; field errors on validation failure.
 */
export async function updateDealAction(
  workspaceSlug: string,
  dealId: string,
  _prev: UpdateDealState,
  formData: FormData,
): Promise<UpdateDealState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = updateDealSchema.safeParse({
    title: formData.get('title'),
    value: formData.get('value') ?? 0,
    margin: formData.get('margin') || undefined,
    expectedClose: formData.get('expectedClose') || undefined,
    description: formData.get('description') || undefined,
    propertyId: formData.get('propertyId') || null,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Verify the deal belongs to this workspace
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) return { error: 'Deal not found' };

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      title: parsed.data.title,
      value: parsed.data.value,
      margin: parsed.data.margin ?? null,
      expectedClose: parsed.data.expectedClose ? new Date(parsed.data.expectedClose) : null,
      description: parsed.data.description || null,
      propertyId: parsed.data.propertyId ?? null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/deals/${dealId}`);
  revalidatePath(`/w/${workspaceSlug}/deals`);
  return { ok: true };
}

/**
 * Mark a deal as WON or LOST. Closes the deal by setting
 * closedAt + the requested terminal stage. Permission is the
 * same as moveDealStage — any deal owner can close it.
 */
export async function closeDealAction(
  workspaceSlug: string,
  dealId: string,
  result: 'WON' | 'LOST',
): Promise<{ ok?: boolean; error?: string }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const existing = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId: workspace.id },
    select: { id: true, stage: true },
  });
  if (!existing) return { error: 'Deal not found' };

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stage: result as PrismaDealStage,
      closedAt: new Date(),
    },
  });

  revalidatePath(`/w/${workspaceSlug}/deals/${dealId}`);
  revalidatePath(`/w/${workspaceSlug}/deals`);
  return { ok: true };
}

export async function deleteDealAction(
  workspaceSlug: string,
  dealId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN']);

  const existing = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId: workspace.id },
    select: { id: true, convertedProject: { select: { id: true } } },
  });
  if (!existing) return { error: 'Deal not found' };
  if (existing.convertedProject) {
    return { error: 'Cannot delete a deal that has been converted to a project. Delete the project first.' };
  }

  await prisma.deal.delete({ where: { id: dealId } });
  revalidatePath(`/w/${workspaceSlug}/deals`);
  return { ok: true };
}


/**
 * Reopen a closed deal. Moves it back to NEGOTIATING and
 * clears closedAt. Same permission set as close.
 */
export async function reopenDealAction(
  workspaceSlug: string,
  dealId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const existing = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) return { error: 'Deal not found' };

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stage: 'NEGOTIATING' as PrismaDealStage,
      closedAt: null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/deals/${dealId}`);
  revalidatePath(`/w/${workspaceSlug}/deals`);
  return { ok: true };
}
