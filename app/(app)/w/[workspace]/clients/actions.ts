'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().max(40).optional(),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PROPERTY_MANAGER']).default('RESIDENTIAL'),
  source: z.string().max(60).optional(),
});

export type CreateClientFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

export async function createClientAction(
  workspaceSlug: string,
  _prev: CreateClientFormState,
  formData: FormData,
): Promise<CreateClientFormState> {
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = clientSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    type: formData.get('type') || 'RESIDENTIAL',
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
      phone: parsed.data.phone || null,
      type: parsed.data.type,
      source: parsed.data.source || null,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceSlug}/clients`);
  redirect(`/w/${workspaceSlug}/clients/${client.id}`);
}
