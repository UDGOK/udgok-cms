'use server';

/**
 * Timesheet approval workflow.
 *
 * State machine:
 *   DRAFT → SUBMITTED → APPROVED
 *                     ↘ REJECTED → (edit) → DRAFT
 *   APPROVED → (unlock) → DRAFT
 *
 * Lock semantics: when status = APPROVED, events in
 * that week cannot be edited. The check lives in
 * updateCheckInEventAction + closeCheckInEventAction
 * via `assertEventNotLocked()`.
 *
 * Self-service submission: a workspace member can
 * submit their own row. Admins/PMs can submit on
 * behalf of anyone (including subs, who don't log
 * in). Approve / reject / unlock are admin/PM
 * only.
 */

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { startOfWeek } from './hours';

export type ApprovalResult =
  | { ok: true }
  | { ok: false; error: string };

const APPROVER_ROLES = ['OWNER', 'ADMIN', 'PM'] as const;
const SUBMITTER_ROLES = ['OWNER', 'ADMIN', 'PM', 'FIELD', 'MEMBER'] as const;

// =====================================================================
// Helpers
// =====================================================================

/**
 * Resolve the canonical weekStart (Monday 00:00) for
 * the row. Always call this before write — the unique
 * constraint depends on the Monday anchor.
 */
function normalizeWeekStart(anchor: Date): Date {
  return startOfWeek(anchor);
}

/**
 * Get-or-create the WeeklyTimesheet row for a
 * (workspace, person, week). Used by all the
 * actions to make the row exist before mutating
 * its status.
 */
async function getOrCreate(
  workspaceId: string,
  personKind: 'employee' | 'sub',
  personId: string,
  weekStart: Date,
) {
  const normalized = normalizeWeekStart(weekStart);
  return prisma.weeklyTimesheet.upsert({
    where: {
      workspaceId_personKind_personId_weekStart: {
        workspaceId,
        personKind,
        personId,
        weekStart: normalized,
      },
    },
    create: {
      workspaceId,
      personKind,
      personId,
      weekStart: normalized,
      status: 'DRAFT',
    },
    update: {},
  });
}

// =====================================================================
// submit
// =====================================================================

const submitSchema = z.object({
  personKind: z.enum(['employee', 'sub']),
  personId: z.string().min(1),
  weekStart: z.string().min(1), // ISO; we'll normalize to Monday
});

/**
 * Submit a timesheet for approval. The caller must
 * be a member of the workspace. For "employee" rows
 * the caller must be either the employee themselves
 * or an OWNER/ADMIN/PM. For "sub" rows only
 * OWNER/ADMIN/PM can submit (subs don't log in).
 */
export async function submitTimesheetAction(
  workspaceSlug: string,
  _prev: ApprovalResult | undefined,
  formData: FormData,
): Promise<ApprovalResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = submitSchema.safeParse({
    personKind: formData.get('personKind'),
    personId: formData.get('personId'),
    weekStart: formData.get('weekStart'),
  });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, [...SUBMITTER_ROLES]);

  // Permission check
  if (parsed.data.personKind === 'employee') {
    const isSelf = parsed.data.personId === userId;
    const isPrivileged = (await isApprover(workspace.id, userId));
    if (!isSelf && !isPrivileged) {
      return { ok: false, error: 'You can only submit your own timesheet' };
    }
  } else {
    // subs — only approvers
    if (!(await isApprover(workspace.id, userId))) {
      return { ok: false, error: 'Only admins can submit a sub timesheet' };
    }
  }

  const weekStart = new Date(parsed.data.weekStart);
  const row = await getOrCreate(workspace.id, parsed.data.personKind, parsed.data.personId, weekStart);

  // Idempotency — submitting an already-submitted or
  // approved timesheet is a no-op. We don't downgrade
  // APPROVED back to SUBMITTED.
  if (row.status === 'APPROVED') {
    return { ok: false, error: 'Already approved; unlock first to resubmit' };
  }
  if (row.status === 'SUBMITTED') {
    return { ok: true };
  }

  await prisma.weeklyTimesheet.update({
    where: { id: row.id },
    data: {
      status: 'SUBMITTED',
      submittedById: userId,
      submittedAt: new Date(),
      // Clear any previous reject context.
      rejectedById: null,
      rejectedAt: null,
      rejectNote: null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/timesheets`);
  return { ok: true };
}

// =====================================================================
// approve
// =====================================================================

const approveSchema = submitSchema;

/**
 * Approve a submitted timesheet. OWNER/ADMIN/PM
 * only. Captures a snapshot of the total hours at
 * the moment of approval.
 */
export async function approveTimesheetAction(
  workspaceSlug: string,
  _prev: ApprovalResult | undefined,
  formData: FormData,
): Promise<ApprovalResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = approveSchema.safeParse({
    personKind: formData.get('personKind'),
    personId: formData.get('personId'),
    weekStart: formData.get('weekStart'),
  });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, [...APPROVER_ROLES]);

  const weekStart = new Date(parsed.data.weekStart);
  const row = await getOrCreate(workspace.id, parsed.data.personKind, parsed.data.personId, weekStart);
  if (row.status !== 'SUBMITTED' && row.status !== 'REJECTED') {
    return { ok: false, error: 'Timesheet must be submitted before approval' };
  }
  if (row.submittedById === userId) {
    // Self-approval is a common accidental flow
    // ("I submitted it, I'll just click approve").
    // Block it — the approver must be a different
    // person.
    return { ok: false, error: 'You cannot approve your own submission' };
  }

  // Compute the total hours at approval time.
  const total = await computeWeekTotal(
    workspace.id,
    parsed.data.personKind,
    parsed.data.personId,
    row.weekStart,
  );

  await prisma.weeklyTimesheet.update({
    where: { id: row.id },
    data: {
      status: 'APPROVED',
      approvedById: userId,
      approvedAt: new Date(),
      totalHoursAtApproval: total,
      // Clear any previous reject context.
      rejectedById: null,
      rejectedAt: null,
      rejectNote: null,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/timesheets`);
  revalidatePath(`/w/${workspaceSlug}/timesheets/approvals`);
  return { ok: true };
}

// =====================================================================
// reject
// =====================================================================

const rejectSchema = submitSchema.extend({
  note: z.string().min(1, 'Rejection note is required').max(500),
});

/**
 * Reject a submitted timesheet with a note. The
 * submitter sees the note and can edit + resubmit.
 */
export async function rejectTimesheetAction(
  workspaceSlug: string,
  _prev: ApprovalResult | undefined,
  formData: FormData,
): Promise<ApprovalResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = rejectSchema.safeParse({
    personKind: formData.get('personKind'),
    personId: formData.get('personId'),
    weekStart: formData.get('weekStart'),
    note: (formData.get('note') as string | null)?.trim(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' };
  }

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, [...APPROVER_ROLES]);

  const weekStart = new Date(parsed.data.weekStart);
  const row = await getOrCreate(workspace.id, parsed.data.personKind, parsed.data.personId, weekStart);
  if (row.status !== 'SUBMITTED') {
    return { ok: false, error: 'Only submitted timesheets can be rejected' };
  }

  await prisma.weeklyTimesheet.update({
    where: { id: row.id },
    data: {
      status: 'REJECTED',
      rejectedById: userId,
      rejectedAt: new Date(),
      rejectNote: parsed.data.note,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/timesheets`);
  revalidatePath(`/w/${workspaceSlug}/timesheets/approvals`);
  return { ok: true };
}

// =====================================================================
// unlock
// =====================================================================

const unlockSchema = submitSchema;

/**
 * Move an APPROVED timesheet back to DRAFT. The
 * audit fields (approvedById, approvedAt,
 * totalHoursAtApproval) stay so we can show
 * "approved at X" later.
 *
 * After unlock, the timesheet can be edited again
 * and re-submitted. The totalHoursAtApproval field
 * is preserved across the cycle.
 */
export async function unlockTimesheetAction(
  workspaceSlug: string,
  _prev: ApprovalResult | undefined,
  formData: FormData,
): Promise<ApprovalResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = unlockSchema.safeParse({
    personKind: formData.get('personKind'),
    personId: formData.get('personId'),
    weekStart: formData.get('weekStart'),
  });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, [...APPROVER_ROLES]);

  const weekStart = new Date(parsed.data.weekStart);
  const row = await getOrCreate(workspace.id, parsed.data.personKind, parsed.data.personId, weekStart);
  if (row.status !== 'APPROVED') {
    return { ok: false, error: 'Only approved timesheets can be unlocked' };
  }

  await prisma.weeklyTimesheet.update({
    where: { id: row.id },
    data: { status: 'DRAFT' },
    // Keep approvedById/approvedAt/totalHoursAtApproval
    // — they're the audit trail of "this timesheet
    // was once approved at X hours".
  });

  revalidatePath(`/w/${workspaceSlug}/timesheets`);
  revalidatePath(`/w/${workspaceSlug}/timesheets/approvals`);
  return { ok: true };
}

// =====================================================================
// Lock check — called from the event edit + close actions
// =====================================================================

/**
 * Returns the WeeklyTimesheet row that locks the
 * event's week, if any (status = APPROVED). Used by
 * the event edit + close actions to block writes.
 */
export async function findLockingTimesheet(
  workspaceId: string,
  eventCheckedInAt: Date,
  personKind: 'employee' | 'sub' | 'unknown',
  personId: string | null,
): Promise<{ id: string; weekStart: Date; status: 'APPROVED' } | null> {
  if (personKind === 'unknown' || !personId) return null;
  const weekStart = startOfWeek(eventCheckedInAt);
  const row = await prisma.weeklyTimesheet.findUnique({
    where: {
      workspaceId_personKind_personId_weekStart: {
        workspaceId,
        personKind,
        personId,
        weekStart,
      },
    },
    select: { id: true, weekStart: true, status: true },
  });
  if (row?.status === 'APPROVED') {
    return { id: row.id, weekStart: row.weekStart, status: 'APPROVED' };
  }
  return null;
}

// =====================================================================
// Internal helpers
// =====================================================================

async function isApprover(workspaceId: string, userId: string): Promise<boolean> {
  const m = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  if (!m) return false;
  return (APPROVER_ROLES as readonly string[]).includes(m.role);
}

async function computeWeekTotal(
  workspaceId: string,
  personKind: 'employee' | 'sub',
  personId: string,
  weekStart: Date,
): Promise<number> {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  const events = await prisma.checkInEvent.findMany({
    where: {
      workspaceId,
      [personKind === 'employee' ? 'userId' : 'subcontractorId']: personId,
      checkedInAt: { gte: weekStart, lt: end },
    },
    select: { editedHours: true, checkedInAt: true, checkedOutAt: true },
  });
  let total = 0;
  for (const e of events) {
    if (e.editedHours !== null) {
      total += Number(e.editedHours);
    } else if (e.checkedOutAt) {
      total += (e.checkedOutAt.getTime() - e.checkedInAt.getTime()) / 3_600_000;
    }
  }
  return Math.round(total * 100) / 100;
}
