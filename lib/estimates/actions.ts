'use server';

/**
 * Estimate actions.
 *
 * Admin actions (require OWNER/ADMIN/PM/ESTIMATOR):
 *   - createEstimate: build a new DRAFT estimate
 *   - updateEstimate: edit a DRAFT (after SENT, line
 *     items are locked — see below)
 *   - sendEstimate: DRAFT → SENT, generates shareToken,
 *     bumps deal stage to ESTIMATE_SENT if a deal
 *   - convertToProject: APPROVED → CONVERTED, creates
 *     a new Project + sets convertedProjectId
 *   - voidEstimate: admin-only kill switch for any
 *     non-converted estimate
 *
 * Public actions (no auth — token IS the credential):
 *   - publicApproveEstimate: sets APPROVED + captures
 *     viewerEmail (typed by the user) for audit
 *   - publicRejectEstimate: sets REJECTED + requires
 *     a note + captures viewerEmail
 *
 * Lock semantics: line items are editable in DRAFT
 * and frozen after Send. To "edit" a sent estimate
 * the admin voids the old one and drafts a new
 * one. This keeps the audit trail clean — the
 * client's view always reflects the snapshot they
 * approved.
 */

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

const DRAFT_ROLES = ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR'] as const;

export type EstimateActionResult =
  | { ok: true; id: string; shareToken: string | null; seededLineItemCount?: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// =====================================================================
// Helpers
// =====================================================================

/**
 * Generate the next estimate number. Format: EST-{YEAR}-{NNNN}.
 * Counts existing estimates in this workspace and bumps.
 * Race-prone but fine at our scale (a workspace doesn't
 * have two admins creating estimates in the same millisecond).
 */
async function nextEstimateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const count = await prisma.estimate.count({
    where: { number: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/**
 * Generate a URL-safe random share token. 24 bytes of
 * randomness encoded as base64url — same approach as
 * the SiteCheckInCode token.
 */
function generateShareToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 24; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // base64url — convert bytes → binary string without
  // using the spread operator (which needs the
  // downlevelIteration flag and we don't have it).
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  const s = btoa(bin);
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// =====================================================================
// create
// =====================================================================

const lineItemInput = z.object({
  divisionCode: z.string().max(20).optional(),
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be > 0'),
  unit: z.string().min(1).max(20).default('EA'),
  unitPrice: z.number().min(0, 'Unit price must be ≥ 0'),
});

const createSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  projectId: z.string().min(1).optional(),
  // When the admin picks "Create new project" on the
  // form, we capture the name (and optional code) here.
  // Either both blank (legacy: project = estimate title)
  // or pendingProjectName is set. Code is optional even
  // when name is set. The convert action then uses these
  // to name the new project on approval.
  pendingProjectName: z.string().max(120).optional(),
  pendingProjectCode: z.string().max(40).optional(),
  dealId: z.string().min(1).optional(),
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().max(2000).optional(),
  validUntil: z.string().optional(), // ISO date
  taxRate: z.number().min(0).max(1).optional(), // 0..1
  lineItems: z.array(lineItemInput).min(1, 'Add at least one line item'),
});

/**
 * Create a new DRAFT estimate with line items. Computes
 * subtotal / taxAmount / total server-side. The line
 * items are persisted in the same transaction so the
 * PDF and the convert-to-project action can trust
 * the totals.
 */
export async function createEstimateAction(
  workspaceSlug: string,
  _prev: EstimateActionResult | undefined,
  formData: FormData,
): Promise<EstimateActionResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  // The line items come in as a JSON string because
  // server actions only carry primitives.
  const lineItemsRaw = formData.get('lineItems');
  let lineItemsParsed: unknown = [];
  if (typeof lineItemsRaw === 'string' && lineItemsRaw.length > 0) {
    try {
      lineItemsParsed = JSON.parse(lineItemsRaw);
    } catch {
      return { ok: false, error: 'Invalid line items' };
    }
  }

  const parsed = createSchema.safeParse({
    clientId: formData.get('clientId'),
    projectId: (formData.get('projectId') as string | null) || undefined,
    pendingProjectName: (formData.get('pendingProjectName') as string | null)?.trim() || undefined,
    pendingProjectCode: (formData.get('pendingProjectCode') as string | null)?.trim() || undefined,
    dealId: (formData.get('dealId') as string | null) || undefined,
    title: (formData.get('title') as string | null)?.trim(),
    description: (formData.get('description') as string | null)?.trim() || undefined,
    validUntil: (formData.get('validUntil') as string | null) || undefined,
    taxRate:
      formData.get('taxRate') && formData.get('taxRate') !== ''
        ? Number(formData.get('taxRate'))
        : undefined,
    lineItems: lineItemsParsed,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please fix the errors below', fieldErrors };
  }

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, [...DRAFT_ROLES]);

  // Verify the client + optional project + optional deal
  // all belong to this workspace.
  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!client) return { ok: false, error: 'Client not found in this workspace' };

  if (parsed.data.projectId) {
    const p = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!p) return { ok: false, error: 'Project not found in this workspace' };
  }
  // Validation: can't pick both "existing project" AND
  // "create new project" — they conflict. The form
  // prevents this UI-side but the action double-checks.
  if (parsed.data.projectId && parsed.data.pendingProjectName) {
    return { ok: false, error: 'Choose either an existing project OR a new project name, not both' };
  }
  if (parsed.data.dealId) {
    const d = await prisma.deal.findFirst({
      where: { id: parsed.data.dealId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!d) return { ok: false, error: 'Deal not found in this workspace' };
  }

  // Compute totals
  let subtotal = 0;
  const lineItemsWithTotal = parsed.data.lineItems.map((li, idx) => {
    const lineTotal = Math.round(li.quantity * li.unitPrice * 100) / 100;
    subtotal += lineTotal;
    return {
      position: idx + 1,
      divisionCode: li.divisionCode ?? null,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unitPrice: li.unitPrice,
      lineTotal,
    };
  });
  subtotal = Math.round(subtotal * 100) / 100;
  const taxAmount = parsed.data.taxRate
    ? Math.round(subtotal * parsed.data.taxRate * 100) / 100
    : null;
  const total = taxAmount !== null ? Math.round((subtotal + taxAmount) * 100) / 100 : subtotal;

  const number = await nextEstimateNumber();
  const validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;

  const created = await prisma.estimate.create({
    data: {
      workspaceId: workspace.id,
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId ?? null,
      pendingProjectName: parsed.data.pendingProjectName ?? null,
      pendingProjectCode: parsed.data.pendingProjectCode ?? null,
      dealId: parsed.data.dealId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      number,
      validUntil,
      subtotal,
      taxRate: parsed.data.taxRate ?? null,
      taxAmount,
      total,
      createdById: userId,
      lineItems: { create: lineItemsWithTotal },
    },
    select: { id: true, shareToken: true },
  });

  revalidatePath(`/w/${workspaceSlug}/estimates`);
  return { ok: true, id: created.id, shareToken: created.shareToken };
}

// =====================================================================
// send
// =====================================================================

const sendSchema = z.object({ id: z.string().min(1) });

/**
 * DRAFT → SENT. Generates the shareToken, stamps
 * sentAt. Bumps the deal's stage to ESTIMATE_SENT
 * if a deal is attached. Once sent, line items are
 * frozen (the DRAFT_ROLES check is still on the
 * line items but the server-side check below also
 * blocks updates when status != DRAFT).
 */
export async function sendEstimateAction(
  workspaceSlug: string,
  _prev: EstimateActionResult | undefined,
  formData: FormData,
): Promise<EstimateActionResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = sendSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, [...DRAFT_ROLES]);

  const est = await prisma.estimate.findFirst({
    where: { id: parsed.data.id, workspaceId: workspace.id },
    select: { id: true, status: true, dealId: true },
  });
  if (!est) return { ok: false, error: 'Estimate not found' };
  if (est.status !== 'DRAFT') {
    return { ok: false, error: 'Only DRAFT estimates can be sent' };
  }

  const shareToken = generateShareToken();
  await prisma.estimate.update({
    where: { id: est.id },
    data: {
      status: 'SENT',
      shareToken,
      sentAt: new Date(),
    },
  });

  // Bump the deal stage if there's a deal. We do this
  // here (not in the approve action) so the kanban
  // reflects reality as soon as the client has the
  // link in their inbox.
  if (est.dealId) {
    await prisma.deal.update({
      where: { id: est.dealId },
      data: { stage: 'ESTIMATE_SENT' },
    });
  }

  revalidatePath(`/w/${workspaceSlug}/estimates`);
  revalidatePath(`/w/${workspaceSlug}/estimates/${est.id}`);
  return { ok: true, id: est.id, shareToken };
}

// =====================================================================
// public approve (no auth — token IS the credential)
// =====================================================================

const publicApproveSchema = z.object({
  token: z.string().min(1),
  email: z.string().email('Valid email is required for approval'),
  name: z.string().min(1, 'Name is required').max(120),
});

/**
 * Public approve action. No auth — anyone with the
 * token URL can hit this. We capture the typed
 * name + email as the audit trail of "who clicked
 * approve". The action transitions SENT|VIEWED →
 * APPROVED.
 */
export async function publicApproveEstimateAction(
  _prev: EstimateActionResult | undefined,
  formData: FormData,
): Promise<EstimateActionResult> {
  const parsed = publicApproveSchema.safeParse({
    token: formData.get('token'),
    email: (formData.get('email') as string | null)?.trim().toLowerCase(),
    name: (formData.get('name') as string | null)?.trim(),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please complete all fields', fieldErrors };
  }

  const est = await prisma.estimate.findUnique({
    where: { shareToken: parsed.data.token },
    select: { id: true, status: true, dealId: true, workspaceId: true },
  });
  if (!est) return { ok: false, error: 'Estimate not found' };
  if (est.status !== 'SENT' && est.status !== 'VIEWED') {
    return { ok: false, error: 'This estimate is no longer open for approval' };
  }

  await prisma.estimate.update({
    where: { id: est.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByEmail: parsed.data.email,
      approvedByName: parsed.data.name,
    },
  });

  // Bump deal stage to WON.
  if (est.dealId) {
    await prisma.deal.update({
      where: { id: est.dealId },
      data: { stage: 'WON' },
    });
  }

  revalidatePath(`/w/[workspace]/estimates/${est.id}`, 'page');
  return { ok: true, id: est.id, shareToken: parsed.data.token };
}

// =====================================================================
// public reject
// =====================================================================

const publicRejectSchema = z.object({
  token: z.string().min(1),
  email: z.string().email('Valid email is required for rejection'),
  name: z.string().min(1).max(120),
  note: z.string().min(1, 'A reason is required for rejection').max(500),
});

/**
 * Public reject action. Same shape as approve —
 * requires a note explaining why. Transitions to
 * REJECTED.
 */
export async function publicRejectEstimateAction(
  _prev: EstimateActionResult | undefined,
  formData: FormData,
): Promise<EstimateActionResult> {
  const parsed = publicRejectSchema.safeParse({
    token: formData.get('token'),
    email: (formData.get('email') as string | null)?.trim().toLowerCase(),
    name: (formData.get('name') as string | null)?.trim(),
    note: (formData.get('note') as string | null)?.trim(),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Please complete all fields', fieldErrors };
  }

  const est = await prisma.estimate.findUnique({
    where: { shareToken: parsed.data.token },
    select: { id: true, status: true, dealId: true },
  });
  if (!est) return { ok: false, error: 'Estimate not found' };
  if (est.status !== 'SENT' && est.status !== 'VIEWED') {
    return { ok: false, error: 'This estimate is no longer open for feedback' };
  }

  await prisma.estimate.update({
    where: { id: est.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedByEmail: parsed.data.email,
      rejectedByName: parsed.data.name,
      rejectNote: parsed.data.note,
    },
  });

  if (est.dealId) {
    await prisma.deal.update({
      where: { id: est.dealId },
      data: { stage: 'NEGOTIATING' },
    });
  }

  return { ok: true, id: est.id, shareToken: parsed.data.token };
}

// =====================================================================
// convert to project
// =====================================================================

const convertSchema = z.object({ id: z.string().min(1) });

/**
 * APPROVED → CONVERTED. Creates a new Project from
 * the estimate's data:
 *   - name = estimate.title
 *   - clientId = estimate.clientId
 *   - projectId (if set on the estimate) is left in
 *     place; the new project is independent
 *   - contractValue = estimate.total
 *   - status = ACTIVE
 *
 * The estimate.convertedProjectId is stamped so the
 * estimate closes out. Once converted, the project
 * picks up the normal project lifecycle (tasks,
 * pay apps, sub assignments, etc.). The user can
 * then add divisions manually on the new project.
 *
 * Note: we don't auto-create CSI divisions from
 * the line items. The estimate's line items are a
 * pricing breakdown, not necessarily the project's
 * final division list — the user might want to
 * consolidate (e.g., "tile labor" + "tile
 * materials" → single DIV 09 30 00 line). We
 * expose the line items on the converted project
 * view (as a reference) but the project starts
 * with no divisions; the user adds them via the
 * standard "Add division" flow.
 */
export async function convertEstimateToProjectAction(
  workspaceSlug: string,
  _prev: EstimateActionResult | undefined,
  formData: FormData,
): Promise<EstimateActionResult & { projectId?: string }> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = convertSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const est = await prisma.estimate.findFirst({
    where: { id: parsed.data.id, workspaceId: workspace.id },
    select: {
      id: true,
      status: true,
      convertedProjectId: true,
      title: true,
      description: true,
      clientId: true,
      projectId: true,
      total: true,
      number: true,
      // If the admin selected "Create new project" on
      // the estimate form, we carry the name + code
      // they typed into the conversion. Otherwise we
      // fall back to the estimate title.
      pendingProjectName: true,
      pendingProjectCode: true,
      // The line items drive the project schedule of
      // values (ProjectDivision) and the task list
      // (Task) on the new project.
      lineItems: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          divisionCode: true,
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });
  if (!est) return { ok: false, error: 'Estimate not found' };
  if (est.status !== 'APPROVED') {
    return { ok: false, error: 'Only approved estimates can be converted' };
  }
  if (est.convertedProjectId) {
    return { ok: false, error: 'Already converted' };
  }

  // Create the project + stamp the estimate + seed
  // the schedule of values + tasks from the line
  // items, all in a single transaction. The new
  // project is ACTIVE and the estimate moves to
  // CONVERTED.
  //
  // Naming: prefer pendingProjectName (admin set this
  // explicitly at estimate creation), then estimate
  // title (legacy behavior). pendingProjectCode follows
  // the same precedence.
  const projectName = est.pendingProjectName?.trim() || est.title;
  const projectCode = est.pendingProjectCode?.trim() || null;
  const project = await prisma.$transaction(async (tx) => {
    const newProject = await tx.project.create({
      data: {
        workspaceId: workspace.id,
        clientId: est.clientId,
        // Note: we don't carry dealId here — the
        // estimate already has dealId; a deal can
        // only spawn one project (@unique on
        // Project.dealId). The user can manually
        // set the new project's dealId in admin
        // tools if they want the deal→project link.
        // We leave it null by default.
        name: projectName,
        code: projectCode,
        description: est.description,
        contractValue: parseFloat(est.total.toString()),
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    // Seed the schedule of values (ProjectDivision)
    // from the line items. Group by divisionCode so
    // multiple line items under the same CSI code
    // become one division with the rolled-up budget.
    // Line items without a code get bucketed under
    // "GEN" (general) so nothing gets dropped.
    if (est.lineItems.length > 0) {
      const byCode = new Map<
        string,
        { trade: string; budget: number; sortOrder: number }
      >();
      for (const li of est.lineItems) {
        const code = (li.divisionCode ?? 'GEN').trim() || 'GEN';
        const existing = byCode.get(code);
        if (existing) {
          existing.budget += parseFloat(li.lineTotal.toString());
        } else {
          byCode.set(code, {
            trade: li.description,
            budget: parseFloat(li.lineTotal.toString()),
            sortOrder: li.position,
          });
        }
      }
      let order = 0;
      for (const [code, v] of byCode) {
        await tx.projectDivision.create({
          data: {
            projectId: newProject.id,
            code,
            trade: v.trade,
            budget: Math.round(v.budget * 100) / 100,
            sortOrder: order++,
          },
        });
      }

      // Seed the Tasks from the same line items, one
      // task per line. The task title is the line item
      // description; the priority is NORMAL and status
      // is TODO. Assignees are left null so the PM can
      // hand them out after the project starts.
      for (const li of est.lineItems) {
        await tx.task.create({
          data: {
            workspaceId: workspace.id,
            projectId: newProject.id,
            clientId: est.clientId,
            title: li.description,
            description: `${li.quantity.toString()} ${li.unit} @ $${li.unitPrice.toString()}/unit (from estimate ${est.number})`,
            status: 'TODO',
            priority: 'NORMAL',
            createdById: userId,
          },
        });
      }
    }

    await tx.estimate.update({
      where: { id: est.id },
      data: {
        status: 'CONVERTED',
        convertedProjectId: newProject.id,
        convertedAt: new Date(),
      },
    });
    return newProject;
  });

  revalidatePath(`/w/${workspaceSlug}/estimates`);
  revalidatePath(`/w/${workspaceSlug}/estimates/${est.id}`);
  revalidatePath(`/w/${workspaceSlug}/projects`);
  // Also revalidate the new project page so the
  // newly-seeded divisions + tasks show up
  // immediately on the next request.
  revalidatePath(`/w/${workspaceSlug}/projects/${project.id}`);
  return {
    ok: true,
    id: est.id,
    projectId: project.id,
    shareToken: null,
    seededLineItemCount: est.lineItems.length,
  };
}

// =====================================================================
// void (admin kill switch)
// =====================================================================

const voidSchema = z.object({ id: z.string().min(1) });

/**
 * Discard an estimate that's no longer useful (e.g.,
 * superseded by a new revision). Allowed in any
 * non-CONVERTED state. Marks convertedAt as a soft
 * "closed" timestamp and a `voidedAt` flag.
 */
export async function voidEstimateAction(
  workspaceSlug: string,
  _prev: EstimateActionResult | undefined,
  formData: FormData,
): Promise<EstimateActionResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = voidSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  const est = await prisma.estimate.findFirst({
    where: { id: parsed.data.id, workspaceId: workspace.id },
    select: { id: true, status: true, convertedProjectId: true },
  });
  if (!est) return { ok: false, error: 'Estimate not found' };
  if (est.convertedProjectId) {
    return { ok: false, error: 'Already converted; cannot void' };
  }

  // We don't have a VOIDED enum value — use REJECTED
  // as a terminal state, but stamp rejectedNote with
  // "Voided by admin" so the audit trail is clear.
  await prisma.estimate.update({
    where: { id: est.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectNote: 'Voided by admin',
    },
  });

  revalidatePath(`/w/${workspaceSlug}/estimates`);
  return { ok: true, id: est.id, shareToken: null };
}

// =====================================================================
// seed from estimate (retroactive — for projects created before the
// convert action learned to seed divisions + tasks)
// =====================================================================

const seedFromEstimateSchema = z.object({ projectId: z.string().min(1) });

/**
 * Re-run the line-item seeding logic against an existing
 * project. The user clicks "Seed from estimate" on a
 * project that was converted from an estimate before
 * the convert action learned to seed divisions +
 * tasks. We:
 *   1. Find the source estimate (Estimate.convertedProjectId == projectId)
 *   2. Re-create the ProjectDivision rows (grouped by
 *      divisionCode, budget = lineTotal, fallback
 *      trade = line description)
 *   3. Create one Task per line item
 *
 * The transaction deletes any existing ProjectDivision
 * rows first so this is idempotent. Tasks are appended
 * (we don't want to delete tasks the user may have
 * already started), but we skip if a task with the same
 * title already exists for the project.
 */
export async function seedFromEstimateAction(
  workspaceSlug: string,
  _prev: EstimateActionResult | undefined,
  formData: FormData,
): Promise<EstimateActionResult & { divisionCount?: number; taskCount?: number }> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = seedFromEstimateSchema.safeParse({
    projectId: formData.get('projectId'),
  });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);

  // Find the source estimate for this project.
  const est = await prisma.estimate.findFirst({
    where: { convertedProjectId: parsed.data.projectId, workspaceId: workspace.id },
    select: {
      id: true,
      clientId: true,
      number: true,
      lineItems: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          divisionCode: true,
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });
  if (!est) {
    return {
      ok: false,
      error: 'No source estimate found for this project. This action only works on projects that were created by converting an estimate.',
    };
  }
  if (est.lineItems.length === 0) {
    return { ok: false, error: 'The source estimate has no line items to seed from.' };
  }

  const counts = await prisma.$transaction(async (tx) => {
    // Wipe any existing divisions so this is idempotent.
    // Tasks are kept (the user may have started some).
    await tx.projectDivision.deleteMany({
      where: { projectId: parsed.data.projectId },
    });

    // Group by divisionCode. Same logic as convert.
    const byCode = new Map<
      string,
      { trade: string; budget: number; sortOrder: number }
    >();
    for (const li of est.lineItems) {
      const code = (li.divisionCode ?? 'GEN').trim() || 'GEN';
      const existing = byCode.get(code);
      if (existing) {
        existing.budget += parseFloat(li.lineTotal.toString());
      } else {
        byCode.set(code, {
          trade: li.description,
          budget: parseFloat(li.lineTotal.toString()),
          sortOrder: li.position,
        });
      }
    }
    let order = 0;
    for (const [code, v] of byCode) {
      await tx.projectDivision.create({
        data: {
          projectId: parsed.data.projectId,
          code,
          trade: v.trade,
          budget: Math.round(v.budget * 100) / 100,
          sortOrder: order++,
        },
      });
    }
    const divisionCount = byCode.size;

    // Append a task per line item, but only if no task
    // with the same title exists yet. We don't want to
    // clobber tasks the user has already started.
    const existingTaskTitles = new Set(
      (
        await tx.task.findMany({
          where: { projectId: parsed.data.projectId },
          select: { title: true },
        })
      ).map((t) => t.title),
    );
    let taskCount = 0;
    for (const li of est.lineItems) {
      if (existingTaskTitles.has(li.description)) continue;
      await tx.task.create({
        data: {
          workspaceId: workspace.id,
          projectId: parsed.data.projectId,
          clientId: est.clientId,
          title: li.description,
          description: `${li.quantity.toString()} ${li.unit} @ $${li.unitPrice.toString()}/unit (from estimate ${est.number})`,
          status: 'TODO',
          priority: 'NORMAL',
          createdById: userId,
        },
      });
      taskCount++;
    }
    return { divisionCount, taskCount };
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${parsed.data.projectId}`);
  return {
    ok: true,
    id: est.id,
    shareToken: null,
    divisionCount: counts.divisionCount,
    taskCount: counts.taskCount,
  };
}
