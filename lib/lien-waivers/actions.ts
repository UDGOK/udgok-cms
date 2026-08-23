/**
 * Lien Waiver server actions.
 *
 * Three flows:
 *   1. GC-internal: create a waiver (often auto-created on PayApp SENT/PAID),
 *      send it to a sub, void it
 *   2. Public sign via the share token (no Clerk session)
 *   3. Helper: shouldBlockPayApp — checks if the project's final
 *      waiver is unsigned (used by PayApp state machine)
 *
 * Numbering is allocated via the DocCounter helper, same as
 * CO, PO, and RFQ.
 */

'use server';

import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { logActivity } from '@/lib/activity/log';
import { nextDocNumber, type DocType } from '@/lib/procurement/number';

function genToken(): string {
  return randomBytes(24).toString('base64url');
}

// ============================================================================
// GC-internal actions
// ============================================================================

const createWaiverSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum([
    'CONDITIONAL_PROGRESS',
    'UNCONDITIONAL_PROGRESS',
    'CONDITIONAL_FINAL',
    'UNCONDITIONAL_FINAL',
  ]),
  amountCents: z.coerce.number().int().nonnegative(),
  throughDate: z.string().min(1),
  subcontractorId: z.string().optional().nullable(),
  payAppId: z.string().optional().nullable(),
  exceptionText: z.string().max(2000).optional().nullable(),
});

export type CreateLienWaiverInput = z.input<typeof createWaiverSchema>;

export async function createLienWaiverAction(raw: CreateLienWaiverInput) {
  const parsed = createWaiverSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;
  const { userId, workspace } = await requireMembership(input.workspaceSlug);

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) return { ok: false as const, error: 'Project not found' };

  // Validate subcontractor belongs to this workspace if provided.
  if (input.subcontractorId) {
    const sub = await prisma.subcontractor.findFirst({
      where: { id: input.subcontractorId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!sub) return { ok: false as const, error: 'Subcontractor not found' };
  }
  // Validate payApp belongs to this project.
  if (input.payAppId) {
    const pa = await prisma.payApp.findFirst({
      where: { id: input.payAppId, projectId: input.projectId },
      select: { id: true },
    });
    if (!pa) return { ok: false as const, error: 'Pay app not found' };
  }

  const number = await prisma.$transaction(async (tx) =>
    nextDocNumber(tx, workspace.id, 'LW' as DocType),
  );

  const waiver = await prisma.lienWaiver.create({
    data: {
      workspaceId: workspace.id,
      projectId: input.projectId,
      number,
      type: input.type,
      amountCents: BigInt(input.amountCents),
      throughDate: new Date(input.throughDate),
      subcontractorId: input.subcontractorId || null,
      payAppId: input.payAppId || null,
      exceptionText: input.exceptionText ?? null,
      templateVersion: 1,
      createdByUserId: userId,
      shareToken: genToken(),
    },
  });

  await prisma.lienWaiverEvent.create({
    data: { waiverId: waiver.id, type: 'CREATED', actor: `user:${userId}` },
  });

  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'created',
    entityType: 'lien_waiver',
    entityId: waiver.id,
    entityName: waiver.number,
    details: `Created ${waiver.type.replace('_', ' ').toLowerCase()} ${waiver.number}`,
  });

  revalidatePath(`/w/${input.workspaceSlug}/projects/${input.projectId}/lien-waivers`);
  return { ok: true as const, waiverId: waiver.id, number: waiver.number };
}

const sendSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  waiverId: z.string().min(1),
});

export async function sendLienWaiverAction(raw: z.input<typeof sendSchema>) {
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' };
  const { userId, workspace } = await requireMembership(parsed.data.workspaceSlug);

  const w = await prisma.lienWaiver.findFirst({
    where: { id: parsed.data.waiverId, projectId: parsed.data.projectId, workspaceId: workspace.id },
  });
  if (!w) return { ok: false as const, error: 'Waiver not found' };
  if (w.status !== 'DRAFT') {
    return { ok: false as const, error: `Cannot send from ${w.status} state` };
  }

  await prisma.lienWaiver.update({
    where: { id: w.id },
    data: { status: 'SENT' },
  });
  await prisma.lienWaiverEvent.create({
    data: { waiverId: w.id, type: 'SENT', actor: `user:${userId}` },
  });
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'sent',
    entityType: 'lien_waiver',
    entityId: w.id,
    entityName: w.number,
    details: `Sent ${w.number} for signature`,
  });
  revalidatePath(`/w/${parsed.data.workspaceSlug}/projects/${parsed.data.projectId}/lien-waivers`);
  return { ok: true as const };
}

const voidSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  waiverId: z.string().min(1),
  reason: z.string().min(1, 'Reason is required').max(500),
});

export async function voidLienWaiverAction(raw: z.input<typeof voidSchema>) {
  const parsed = voidSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { userId, workspace } = await requireMembership(parsed.data.workspaceSlug);

  const w = await prisma.lienWaiver.findFirst({
    where: { id: parsed.data.waiverId, projectId: parsed.data.projectId, workspaceId: workspace.id },
  });
  if (!w) return { ok: false as const, error: 'Waiver not found' };
  if (w.status === 'SIGNED' || w.status === 'VOIDED') {
    return { ok: false as const, error: `Cannot void a ${w.status.toLowerCase()} waiver` };
  }

  await prisma.lienWaiver.update({
    where: { id: w.id },
    data: {
      status: 'VOIDED',
      voidedAt: new Date(),
      voidedByUserId: userId,
      voidedReason: parsed.data.reason,
    },
  });
  await prisma.lienWaiverEvent.create({
    data: { waiverId: w.id, type: 'VOIDED', actor: `user:${userId}`, metadata: { reason: parsed.data.reason } },
  });
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'updated',
    entityType: 'lien_waiver',
    entityId: w.id,
    entityName: w.number,
    details: `Voided ${w.number}: ${parsed.data.reason.slice(0, 80)}`,
  });
  revalidatePath(`/w/${parsed.data.workspaceSlug}/projects/${parsed.data.projectId}/lien-waivers`);
  return { ok: true as const };
}

// ============================================================================
// Public sign action
// ============================================================================

const publicSignSchema = z.object({
  token: z.string().min(1),
  signerName: z.string().min(1, 'Name is required').max(200),
  signerTitle: z.string().max(100).optional().nullable(),
  signerEmail: z.string().email().max(200).optional().nullable(),
  exceptionText: z.string().max(2000).optional().nullable(),
});

export async function publicSignLienWaiverAction(raw: z.input<typeof publicSignSchema>) {
  const parsed = publicSignSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: 'Please fill in your name',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const w = await prisma.lienWaiver.findUnique({
    where: { shareToken: parsed.data.token },
  });
  if (!w) return { ok: false as const, error: 'Invalid token' };
  if (w.status !== 'SENT' && w.status !== 'VIEWED') {
    return { ok: false as const, error: `This waiver is ${w.status} and cannot be signed` };
  }

  await prisma.lienWaiver.update({
    where: { id: w.id },
    data: {
      status: 'SIGNED',
      signedAt: new Date(),
      signerName: parsed.data.signerName,
      signerTitle: parsed.data.signerTitle ?? null,
      signerEmail: parsed.data.signerEmail ?? null,
      signatureMethod: 'TYPED',
      // If the sub added an exception, append it (preserves GC's text).
      exceptionText: parsed.data.exceptionText
        ? [w.exceptionText, parsed.data.exceptionText].filter(Boolean).join('\n\n')
        : w.exceptionText,
    },
  });
  await prisma.lienWaiverEvent.create({
    data: {
      waiverId: w.id,
      type: 'SIGNED',
      actor: `signer:${parsed.data.signerName}`,
    },
  });
  await logActivity({
    workspaceId: w.workspaceId,
    action: 'acknowledged',
    entityType: 'lien_waiver',
    entityId: w.id,
    entityName: w.number,
    details: `Signed by ${parsed.data.signerName}`,
  });
  revalidatePath(`/lw/${parsed.data.token}`);
  revalidatePath(`/w`);
  return { ok: true as const };
}

// ============================================================================
// Helper: should a PayApp be blocked because a required waiver
// (final, or a progress waiver with unsigned status) is missing?
// ============================================================================

export interface WaiverGate {
  blocks: boolean;
  reason: string | null;
  unsignedWaiverIds: string[];
}

export async function checkWaiverGateForPayApp(
  projectId: string,
  workspaceId: string,
  payAppId: string | null,
): Promise<WaiverGate> {
  // Final waivers are HARD blocks — if a CONDITIONAL_FINAL is
  // outstanding for this project, block.
  const unsignedFinals = await prisma.lienWaiver.count({
    where: {
      projectId,
      workspaceId,
      type: { in: ['CONDITIONAL_FINAL', 'UNCONDITIONAL_FINAL'] },
      status: { in: ['DRAFT', 'SENT', 'VIEWED'] },
    },
  });
  if (unsignedFinals > 0) {
    return {
      blocks: true,
      reason: `${unsignedFinals} final lien waiver${unsignedFinals === 1 ? '' : 's'} not yet signed`,
      unsignedWaiverIds: [],
    };
  }
  // Soft gate: progress waivers tied to THIS pay app.
  if (payAppId) {
    const unsignedForPayApp = await prisma.lienWaiver.findMany({
      where: {
        projectId,
        workspaceId,
        payAppId,
        status: { in: ['DRAFT', 'SENT', 'VIEWED'] },
      },
      select: { id: true },
    });
    if (unsignedForPayApp.length > 0) {
      return {
        blocks: false, // soft — don't block the pay app
        reason: `${unsignedForPayApp.length} progress waiver${unsignedForPayApp.length === 1 ? '' : 's'} pending for this pay app`,
        unsignedWaiverIds: unsignedForPayApp.map((w) => w.id),
      };
    }
  }
  return { blocks: false, reason: null, unsignedWaiverIds: [] };
}
