/**
 * Change Order server actions.
 *
 * Three flows:
 *   1. GC-internal: create / update / submit / withdraw / re-submit
 *   2. Owner/architect approval via the public share token (no Clerk session)
 *   3. Auto-update of project contract sum when a CO is approved
 *
 * Numbering is allocated via the DocCounter helper — same as PO
 * and RFQ — so concurrent clicks never collide.
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
// GC-internal actions (Clerk session required)
// ============================================================================

const createCoSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum(['ADDITIVE', 'DEDUCTIVE', 'NEUTRAL', 'TIME_ONLY']),
  pricingMethod: z.enum(['LUMP_SUM', 'UNIT_PRICE', 'TIME_AND_MATERIALS', 'COST_PLUS']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional().nullable(),
  reasonCode: z
    .enum([
      'OWNER_REQUEST',
      'RFI',
      'ASI',
      'DIFFERING_SITE_CONDITION',
      'CODE_REQUIREMENT',
      'DESIGN_OMISSION',
      'FIELD_CONDITION',
      'OTHER',
    ])
    .optional()
    .nullable(),
  thisCOAmount: z.coerce.number().finite(),
  timeImpactDays: z.coerce.number().int().default(0),
  newSubstantialCompletion: z.string().optional().nullable(),
  // Map of projectDivisionId -> { thisCOAmount, newBudgetDelta }
  divisionAllocations: z
    .record(
      z.string(),
      z.object({
        thisCOAmount: z.coerce.number().default(0),
        newBudgetDelta: z.coerce.number().default(0),
      }),
    )
    .default({}),
});

export type CreateChangeOrderInput = z.input<typeof createCoSchema>;

export async function createChangeOrderAction(raw: CreateChangeOrderInput) {
  const parsed = createCoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;
  const { userId, workspace } = await requireMembership(input.workspaceSlug);

  // Load the project to capture the current contract sum. We also
  // compute the net of all previously-APPROVED COs (the running
  // "net prior COs" snapshot that goes on the AIA G701 line 3).
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, workspaceId: workspace.id },
    select: {
      id: true,
      contractValue: true,
      endDate: true,
    },
  });
  if (!project) return { ok: false as const, error: 'Project not found' };

  const approvedCOsTotal = await prisma.changeOrder.aggregate({
    where: { projectId: input.projectId, workspaceId: workspace.id, status: 'APPROVED' },
    _sum: { thisCOAmount: true },
  });
  const originalContractSum = project.contractValue ? Number(project.contractValue) : 0;
  const netPriorCOs = approvedCOsTotal._sum.thisCOAmount
    ? Number(approvedCOsTotal._sum.thisCOAmount)
    : 0;
  const priorContractSum = originalContractSum + netPriorCOs;
  const newContractSum = priorContractSum + input.thisCOAmount;

  // Allocate the CO number from the DocCounter. Same atomic
  // insert-or-increment pattern as POs and RFQs.
  const number = await prisma.$transaction(async (tx) => {
    return nextDocNumber(tx, workspace.id, 'CO' as DocType);
  });

  // Build the divisions array. Use the input map, dropping any
  // divisions with no allocation.
  const divisions = Object.entries(input.divisionAllocations)
    .filter(([, v]) => v.thisCOAmount !== 0 || v.newBudgetDelta !== 0)
    .map(([projectDivisionId, v], i) => ({
      projectDivisionId,
      thisCOAmount: v.thisCOAmount,
      newBudgetDelta: v.newBudgetDelta,
      sortOrder: i,
    }));

  // userId is the Clerk user ID, which == User.id in our schema.
  const meId = userId;
  if (!meId) return { ok: false as const, error: 'No user context' };

  const co = await prisma.changeOrder.create({
    data: {
      workspaceId: workspace.id,
      projectId: input.projectId,
      number,
      type: input.type,
      pricingMethod: input.pricingMethod,
      title: input.title,
      description: input.description ?? null,
      reasonCode: input.reasonCode ?? null,
      originalContractSum,
      netPriorCOs,
      priorContractSum,
      thisCOAmount: input.thisCOAmount,
      newContractSum,
      timeImpactDays: input.timeImpactDays,
      newSubstantialCompletion: input.newSubstantialCompletion
        ? new Date(input.newSubstantialCompletion)
        : null,
      createdByUserId: meId,
      shareToken: genToken(),
      divisions: divisions.length > 0 ? { create: divisions } : undefined,
    },
  });

  await logActivity({
    workspaceId: workspace.id,
    actorId: meId,
    action: 'created',
    entityType: 'change_order',
    entityId: co.id,
    entityName: co.number,
    details: `Created CO ${co.number} — ${co.title}`,
  });

  revalidatePath(`/w/${input.workspaceSlug}/projects/${input.projectId}/change-orders`);
  return { ok: true as const, changeOrderId: co.id, number: co.number };
}

const submitSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  coId: z.string().min(1),
});

export async function submitChangeOrderAction(raw: z.input<typeof submitSchema>) {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' };
  const { userId, workspace } = await requireMembership(parsed.data.workspaceSlug);

  const co = await prisma.changeOrder.findFirst({
    where: { id: parsed.data.coId, projectId: parsed.data.projectId, workspaceId: workspace.id },
  });
  if (!co) return { ok: false as const, error: 'Change order not found' };
  if (co.status !== 'DRAFT' && co.status !== 'REVISED') {
    return { ok: false as const, error: `Cannot submit from ${co.status}` };
  }

  const meId = userId;
  if (!meId) return { ok: false as const, error: 'No user context' };

  await prisma.changeOrder.update({
    where: { id: co.id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedByUserId: meId,
    },
  });
  await logActivity({
    workspaceId: workspace.id,
    actorId: meId,
    action: 'sent',
    entityType: 'change_order',
    entityId: co.id,
    entityName: co.number,
    details: `Submitted CO ${co.number} for owner/architect review`,
  });
  revalidatePath(`/w/${parsed.data.workspaceSlug}/projects/${parsed.data.projectId}/change-orders`);
  revalidatePath(`/co/${co.shareToken}`);
  return { ok: true as const };
}

const withdrawSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().min(1),
  coId: z.string().min(1),
});

export async function withdrawChangeOrderAction(raw: z.input<typeof withdrawSchema>) {
  const parsed = withdrawSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' };
  const { workspace } = await requireMembership(parsed.data.workspaceSlug);
  // userId not needed for withdraw — we just log the action as the
  // workspace actor (system attribution)

  const co = await prisma.changeOrder.findFirst({
    where: { id: parsed.data.coId, projectId: parsed.data.projectId, workspaceId: workspace.id },
  });
  if (!co) return { ok: false as const, error: 'Change order not found' };
  if (co.status === 'APPROVED' || co.status === 'INCLUDED_IN_PAY_APP') {
    return { ok: false as const, error: `Cannot withdraw an ${co.status.toLowerCase()} CO` };
  }

  await prisma.changeOrder.update({
    where: { id: co.id },
    data: { status: 'WITHDRAWN' },
  });
  await logActivity({
    workspaceId: workspace.id,
    action: 'updated',
    entityType: 'change_order',
    entityId: co.id,
    entityName: co.number,
    details: `Withdrew CO ${co.number}`,
  });
  revalidatePath(`/w/${parsed.data.workspaceSlug}/projects/${parsed.data.projectId}/change-orders`);
  return { ok: true as const };
}

// ============================================================================
// Public-token actions (no Clerk session — token is the credential)
// ============================================================================

const publicApproveSchema = z.object({
  token: z.string().min(1),
  role: z.enum(['OWNER', 'ARCHITECT']),
  signatoryName: z.string().min(1, 'Name is required').max(200),
  signatoryEmail: z.string().email().optional().or(z.literal('')).transform((s) => s || null),
});

/**
 * Public approve endpoint. The token in the URL IS the credential;
 * we don't require a Clerk session. The typed name + email is the
 * audit trail.
 *
 * On the LAST signature (both owner + architect) the CO is
 * promoted to APPROVED and the project's contract value is
 * updated. We don't auto-generate a new pay app — that's a
 * deliberate human step.
 */
export async function publicApproveChangeOrderAction(
  raw: z.input<typeof publicApproveSchema>,
) {
  const parsed = publicApproveSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: 'Please provide your full name',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const co = await prisma.changeOrder.findUnique({
    where: { shareToken: parsed.data.token },
  });
  if (!co) return { ok: false as const, error: 'Invalid token' };
  if (co.status !== 'SUBMITTED' && co.status !== 'UNDER_REVIEW' && co.status !== 'PARTIALLY_APPROVED') {
    return {
      ok: false as const,
      error: `This change order is in ${co.status} state and cannot be approved`,
    };
  }

  const now = new Date();
  const me = await prisma.user.findFirst({
    where: { email: 'yasir@udgok.com' },
    select: { id: true },
  });
  const meId = me?.id ?? null;

  if (parsed.data.role === 'OWNER') {
    if (co.ownerApprovedAt) {
      return { ok: false as const, error: 'Owner has already signed this change order' };
    }
    await prisma.changeOrder.update({
      where: { id: co.id },
      data: {
        ownerApprovedAt: now,
        ownerApprovedByUserId: meId,
        ownerSignatoryName: parsed.data.signatoryName,
        status: co.architectApprovedAt ? 'APPROVED' : 'PARTIALLY_APPROVED',
      },
    });
  } else {
    if (co.architectApprovedAt) {
      return { ok: false as const, error: 'Architect has already signed this change order' };
    }
    await prisma.changeOrder.update({
      where: { id: co.id },
      data: {
        architectApprovedAt: now,
        architectApprovedByUserId: meId,
        architectSignatoryName: parsed.data.signatoryName,
        status: co.ownerApprovedAt ? 'APPROVED' : 'PARTIALLY_APPROVED',
      },
    });
  }

  // If both signatures are now in, update the project's contract
  // sum to match the CO's newContractSum. This is the "money
  // change" moment — the baseline moves.
  const refreshed = await prisma.changeOrder.findUnique({ where: { id: co.id } });
  if (refreshed?.status === 'APPROVED') {
    await prisma.project.update({
      where: { id: co.projectId },
      data: {
        contractValue: refreshed.newContractSum,
        endDate:
          refreshed.newSubstantialCompletion ?? undefined,
      },
    });
  }

  await logActivity({
    workspaceId: co.workspaceId,
    action: 'acknowledged',
    entityType: 'change_order',
    entityId: co.id,
    entityName: co.number,
    details: `${parsed.data.role} approved by ${parsed.data.signatoryName}`,
  });
  revalidatePath(`/w`);
  return { ok: true as const };
}

const publicRejectSchema = z.object({
  token: z.string().min(1),
  signatoryName: z.string().min(1).max(200),
  reason: z.string().min(1, 'Please tell us why').max(2000),
});

export async function publicRejectChangeOrderAction(
  raw: z.input<typeof publicRejectSchema>,
) {
  const parsed = publicRejectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: 'Please fill in all fields',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const co = await prisma.changeOrder.findUnique({
    where: { shareToken: parsed.data.token },
  });
  if (!co) return { ok: false as const, error: 'Invalid token' };
  if (co.status !== 'SUBMITTED' && co.status !== 'UNDER_REVIEW' && co.status !== 'PARTIALLY_APPROVED') {
    return { ok: false as const, error: `This change order is in ${co.status} state` };
  }
  await prisma.changeOrder.update({
    where: { id: co.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: `${parsed.data.signatoryName}: ${parsed.data.reason}`,
    },
  });
  await logActivity({
    workspaceId: co.workspaceId,
    action: 'disputed',
    entityType: 'change_order',
    entityId: co.id,
    entityName: co.number,
    details: `Rejected: ${parsed.data.reason.slice(0, 120)}`,
  });
  revalidatePath(`/co/${parsed.data.token}`);
  return { ok: true as const };
}

// ============================================================================
// Approve summary for a project — used by the page to decide
// if there's a CO awaiting approval and what % of the contract
// is CO-driven.
// ============================================================================

export async function getCoSummaryForProject(projectId: string, workspaceId: string) {
  const groups = await prisma.changeOrder.groupBy({
    by: ['status'],
    where: { projectId, workspaceId },
    _count: true,
    _sum: { thisCOAmount: true },
  });
  return groups.map((g) => ({
    status: g.status,
    count: g._count,
    total: g._sum.thisCOAmount ? Number(g._sum.thisCOAmount) : 0,
  }));
}
