'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const propertySchema = z.object({
  clientId: z.string().min(1),
  label: z.string().min(1, 'Label is required').max(120),
  address: z.string().min(1, 'Address is required').max(200),
  city: z.string().min(1).max(80),
  state: z.string().min(2).max(40),
  zip: z.string().min(1, 'Zip is required').max(20),
  sqft: z.coerce.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreatePropertyState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

export async function createPropertyAction(
  workspaceSlug: string,
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR', 'FIELD']);

  const parsed = propertySchema.safeParse({
    clientId: formData.get('clientId'),
    label: formData.get('label'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    zip: formData.get('zip') || undefined,
    sqft: formData.get('sqft') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: 'Please fix the errors below', fieldErrors };
  }

  // Verify the client belongs to this workspace
  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: workspace.id },
  });
  if (!client) return { error: 'Client not found' };

  await prisma.property.create({
    data: {
      clientId: parsed.data.clientId,
      label: parsed.data.label,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      sqft: parsed.data.sqft || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/clients/${parsed.data.clientId}`);
  return { ok: true };
}
