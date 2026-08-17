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
