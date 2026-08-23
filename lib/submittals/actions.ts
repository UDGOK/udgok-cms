/**
 * Submittal + RFI server actions.
 *
 * Two feature surfaces in one file because they share the same
 * "GC creates, public token used by architect to review" pattern.
 * Public actions are token-authed (no Clerk session).
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
// Submittal actions
// ============================================================================

const createSubmittalSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  specSection: z.string().min(1).max(20), // e.g. "09 65 19"
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional().nullable(),
  subcontractorId: z.string().optional().nullable(),
  requiredByDate: z.string().optional().nullable(),
});

export type CreateSubmittalInput = z.input<typeof createSubmittalSchema>;

export async function createSubmittalAction(raw: CreateSubmittalInput) {
  const parsed = createSubmittalSchema.safeParse(raw);
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

  // Allocate the per-project/per-section sequence. Cheap, in the
  // same transaction so two concurrent submittals don't collide.
  const result = await prisma.$transaction(async (tx) => {
    const number = await nextDocNumber(tx, workspace.id, 'SUB' as DocType);
    // Find max specSequence for this specSection on this project.
    const maxRow = await tx.submittal.aggregate({
      where: { projectId: input.projectId, specSection: input.specSection },
      _max: { specSequence: true },
    });
    const specSequence = (maxRow._max.specSequence ?? 0) + 1;
    const submittal = await tx.submittal.create({
      data: {
        workspaceId: workspace.id,
        projectId: input.projectId,
        number,
        specSection: input.specSection,
        specSequence,
        title: input.title,
        description: input.description ?? null,
        subcontractorId: input.subcontractorId || null,
        requiredByDate: input.requiredByDate ? new Date(input.requiredByDate) : null,
        createdByUserId: userId,
        shareToken: genToken(),
      },
    });
    return submittal;
  });

  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'created',
    entityType: 'submittal',
    entityId: result.id,
    entityName: result.number,
    details: `Created submittal ${result.number} (${input.specSection}-${result.specSequence}): ${result.title}`,
  });

  revalidatePath(`/w/${input.workspaceSlug}/projects/${input.projectId}/submittals`);
  return { ok: true as const, submittalId: result.id, number: result.number };
}

const submitSubmittalSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  submittalId: z.string().min(1),
});

export async function submitSubmittalAction(raw: z.input<typeof submitSubmittalSchema>) {
  const parsed = submitSubmittalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' };
  const { userId, workspace } = await requireMembership(parsed.data.workspaceSlug);

  const s = await prisma.submittal.findFirst({
    where: { id: parsed.data.submittalId, projectId: parsed.data.projectId, workspaceId: workspace.id },
  });
  if (!s) return { ok: false as const, error: 'Submittal not found' };
  if (s.status !== 'DRAFT') {
    return { ok: false as const, error: `Cannot submit from ${s.status}` };
  }
  await prisma.submittal.update({
    where: { id: s.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'sent',
    entityType: 'submittal',
    entityId: s.id,
    entityName: s.number,
    details: `Sent submittal ${s.number} for review`,
  });
  revalidatePath(`/w/${parsed.data.workspaceSlug}/projects/${parsed.data.projectId}/submittals`);
  return { ok: true as const };
}

// Public review: architect/engineer stamps the disposition.
const publicReviewSubmittalSchema = z.object({
  token: z.string().min(1),
  disposition: z.enum(['APPROVED', 'APPROVED_AS_NOTED', 'REVISE_AND_RESUBMIT', 'REJECTED']),
  reviewerName: z.string().min(1, 'Your name is required').max(200),
  reviewerEmail: z.string().email().optional().nullable(),
  reviewNotes: z.string().max(2000).optional().nullable(),
});

export async function publicReviewSubmittalAction(
  raw: z.input<typeof publicReviewSubmittalSchema>,
) {
  const parsed = publicReviewSubmittalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: 'Please provide your name and a disposition' };
  }
  const s = await prisma.submittal.findUnique({
    where: { shareToken: parsed.data.token },
  });
  if (!s) return { ok: false as const, error: 'Invalid token' };
  if (s.status === 'APPROVED' || s.status === 'REJECTED' || s.status === 'VOID') {
    return { ok: false as const, error: `This submittal is already ${s.status.toLowerCase()}` };
  }

  await prisma.submittal.update({
    where: { id: s.id },
    data: {
      status: parsed.data.disposition,
      disposition: parsed.data.disposition,
      reviewedAt: new Date(),
      reviewerName: parsed.data.reviewerName,
      reviewerEmail: parsed.data.reviewerEmail ?? null,
      reviewNotes: parsed.data.reviewNotes ?? null,
    },
  });
  await logActivity({
    workspaceId: s.workspaceId,
    action: 'acknowledged',
    entityType: 'submittal',
    entityId: s.id,
    entityName: s.number,
    details: `Reviewed by ${parsed.data.reviewerName}: ${parsed.data.disposition}`,
  });
  revalidatePath(`/sub/${parsed.data.token}`);
  revalidatePath(`/w`);
  return { ok: true as const };
}

// ============================================================================
// RFI actions
// ============================================================================

const createRfiSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  subject: z.string().min(1, 'Subject is required').max(200),
  question: z.string().min(1, 'Question is required').max(8000),
  dueDate: z.string().optional().nullable(),
  costImpact: z.coerce.boolean().default(false),
  scheduleImpact: z.coerce.boolean().default(false),
});

export type CreateRfiInput = z.input<typeof createRfiSchema>;

export async function createRfiAction(raw: CreateRfiInput) {
  const parsed = createRfiSchema.safeParse(raw);
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

  const number = await prisma.$transaction(async (tx) =>
    nextDocNumber(tx, workspace.id, 'RFI' as DocType),
  );

  const rfi = await prisma.rfi.create({
    data: {
      workspaceId: workspace.id,
      projectId: input.projectId,
      number,
      subject: input.subject,
      question: input.question,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      costImpact: input.costImpact,
      scheduleImpact: input.scheduleImpact,
      createdByUserId: userId,
      shareToken: genToken(),
    },
  });

  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'created',
    entityType: 'rfi',
    entityId: rfi.id,
    entityName: rfi.number,
    details: `Created RFI ${rfi.number}: ${rfi.subject}`,
  });
  revalidatePath(`/w/${input.workspaceSlug}/projects/${input.projectId}/rfis`);
  return { ok: true as const, rfiId: rfi.id, number: rfi.number };
}

const sendRfiSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  rfiId: z.string().min(1),
});

export async function sendRfiAction(raw: z.input<typeof sendRfiSchema>) {
  const parsed = sendRfiSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' };
  const { userId, workspace } = await requireMembership(parsed.data.workspaceSlug);

  const rfi = await prisma.rfi.findFirst({
    where: { id: parsed.data.rfiId, projectId: parsed.data.projectId, workspaceId: workspace.id },
  });
  if (!rfi) return { ok: false as const, error: 'RFI not found' };
  if (rfi.status !== 'DRAFT') {
    return { ok: false as const, error: `Cannot send from ${rfi.status}` };
  }
  await prisma.rfi.update({
    where: { id: rfi.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });
  await logActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'sent',
    entityType: 'rfi',
    entityId: rfi.id,
    entityName: rfi.number,
    details: `Sent RFI ${rfi.number} to architect/engineer`,
  });
  revalidatePath(`/w/${parsed.data.workspaceSlug}/projects/${parsed.data.projectId}/rfis`);
  return { ok: true as const };
}

const publicAnswerRfiSchema = z.object({
  token: z.string().min(1),
  answer: z.string().min(1, 'Answer is required').max(8000),
  answeredByName: z.string().min(1, 'Your name is required').max(200),
  answeredByEmail: z.string().email().optional().nullable(),
  // If the answer flags an impact, capture amounts so the GC can
  // build a Change Order off this RFI.
  costImpact: z.coerce.boolean().default(false),
  costImpactAmount: z.coerce.number().optional().nullable(),
  scheduleImpact: z.coerce.boolean().default(false),
  scheduleImpactDays: z.coerce.number().int().optional().default(0),
});

export async function publicAnswerRfiAction(raw: z.input<typeof publicAnswerRfiSchema>) {
  const parsed = publicAnswerRfiSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: 'Please provide your name and an answer' };
  }
  const rfi = await prisma.rfi.findUnique({
    where: { shareToken: parsed.data.token },
  });
  if (!rfi) return { ok: false as const, error: 'Invalid token' };
  if (rfi.status !== 'SUBMITTED') {
    return { ok: false as const, error: `This RFI is ${rfi.status.toLowerCase()} and cannot be answered` };
  }

  await prisma.rfi.update({
    where: { id: rfi.id },
    data: {
      status: 'ANSWERED',
      answer: parsed.data.answer,
      answeredAt: new Date(),
      answeredByName: parsed.data.answeredByName,
      answeredByEmail: parsed.data.answeredByEmail ?? null,
      costImpact: parsed.data.costImpact,
      costImpactAmount: parsed.data.costImpact && parsed.data.costImpactAmount
        ? parsed.data.costImpactAmount : null,
      scheduleImpact: parsed.data.scheduleImpact,
      scheduleImpactDays: parsed.data.scheduleImpactDays ?? 0,
    },
  });
  await logActivity({
    workspaceId: rfi.workspaceId,
    action: 'acknowledged',
    entityType: 'rfi',
    entityId: rfi.id,
    entityName: rfi.number,
    details: `Answered by ${parsed.data.answeredByName}${parsed.data.costImpact ? ' (cost impact flagged)' : ''}`,
  });
  revalidatePath(`/rfi/${parsed.data.token}`);
  revalidatePath(`/w`);
  return { ok: true as const };
}
