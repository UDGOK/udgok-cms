'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation'; // we'll add this
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';

const createClientSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PROPERTY_MANAGER']).default('RESIDENTIAL'),
  source: z.string().max(60).optional(),
});

export type CreateClientInput = z.input<typeof createClientSchema>;
export type CreateClientResult = { id: string } | { error: string };

export async function createClient(
  workspaceId: string,
  input: CreateClientInput,
): Promise<CreateClientResult> {
  await requireRole(workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const client = await prisma.client.create({
    data: {
      workspaceId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      type: parsed.data.type,
      source: parsed.data.source || null,
    },
    select: { id: true },
  });

  revalidatePath(`/w/${workspaceId}/clients`);
  return { id: client.id };
}

export async function archiveClient(workspaceId: string, clientId: string) {
  await requireRole(workspaceId, ['OWNER', 'ADMIN']);
  await prisma.client.update({
    where: { id: clientId, workspaceId },
    data: { status: 'ARCHIVED' },
  });
  revalidatePath(`/w/${workspaceId}/clients`);
  revalidatePath(`/w/${workspaceId}/clients/${clientId}`);
}
