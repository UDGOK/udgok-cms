'use server';

/**
 * Timesheet admin actions. Permissioning: OWNER /
 * ADMIN / PM only. Employees can see their own
 * timesheet (read-only via the queries) but can't
 * edit.
 *
 * Three actions:
 *   - updateEvent: edit hours / timestamps / note on
 *                  a single check-in event
 *   - closeEvent:  set checkedOutAt = now on an
 *                  open event
 *   - bulkClose:   close all open events older than
 *                  a threshold (default 12h). Useful
 *                  for "end of day" cleanup.
 */

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';

export type EditResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const UPDATE_ROLES = ['OWNER', 'ADMIN', 'PM'] as const;

const updateEventSchema = z.object({
  eventId: z.string().min(1),
  // editedHours as a string so the form-data roundtrip
  // doesn't drop precision. Empty string = clear the
  // override and fall back to the computed value.
  editedHours: z.string().optional(),
  // Both optional. ISO datetime strings. If provided,
  // we update the underlying timestamp.
  checkedInAt: z.string().optional(),
  checkedOutAt: z.string().optional(),
  // Edit note is REQUIRED when editedHours is set —
  // it's the audit context. Optional when only
  // timestamps are being touched.
  editNote: z.string().max(500).optional(),
});

/**
 * Update a check-in event. The caller (admin) can:
 *   - override hours (sets editedHours + editNote)
 *   - edit checkedInAt / checkedOutAt
 *   - clear the override (empty editedHours)
 *
 * On success, revalidates the timesheet pages so
 * the grid + per-person detail refresh.
 */
export async function updateCheckInEventAction(
  workspaceSlug: string,
  _prev: EditResult | undefined,
  formData: FormData,
): Promise<EditResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = updateEventSchema.safeParse({
    eventId: formData.get('eventId'),
    // We deliberately don't `.trim() || undefined`
    // here — an explicit empty string is the "clear
    // override" signal, distinct from "not provided".
    // Whitespace-only strings (e.g. "  ") get trimmed
    // to "" and treated as the same "clear" signal.
    editedHours: typeof formData.get('editedHours') === 'string'
      ? (formData.get('editedHours') as string).trim()
      : undefined,
    checkedInAt: (formData.get('checkedInAt') as string | null)?.trim() || undefined,
    checkedOutAt: (formData.get('checkedOutAt') as string | null)?.trim() || undefined,
    editNote: (formData.get('editNote') as string | null)?.trim() || undefined,
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
  await requireRole(workspace.id, [...UPDATE_ROLES]);

  // Confirm the event belongs to this workspace
  // before allowing edits.
  const existing = await prisma.checkInEvent.findFirst({
    where: { id: parsed.data.eventId, workspaceId: workspace.id },
    select: { id: true, checkedInAt: true, checkedOutAt: true, editedHours: true },
  });
  if (!existing) {
    return { ok: false, error: 'Event not found in this workspace' };
  }

  // Build the data to write. Only touch fields the
  // caller actually sent.
  const data: Record<string, unknown> = {};

  // Hours override
  if (parsed.data.editedHours !== undefined) {
    if (parsed.data.editedHours === '') {
      // Empty string = clear the override.
      data.editedHours = null;
      data.editedById = null;
      data.editedAt = null;
      data.editNote = null;
    } else {
      const h = parseFloat(parsed.data.editedHours);
      if (Number.isNaN(h) || h < 0 || h > 24) {
        return { ok: false, error: 'Edited hours must be a number between 0 and 24' };
      }
      if (!parsed.data.editNote) {
        return { ok: false, error: 'Edit note is required when overriding hours' };
      }
      data.editedHours = h;
      data.editedById = userId;
      data.editedAt = new Date();
      data.editNote = parsed.data.editNote;
    }
  } else if (parsed.data.editNote) {
    // Note set without an hours change — just
    // attach the note to the event (useful for
    // "foreman left early, see text").
    data.editNote = parsed.data.editNote;
  }

  // Timestamp edits
  if (parsed.data.checkedInAt) {
    const d = new Date(parsed.data.checkedInAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: 'Invalid checkedInAt timestamp' };
    }
    data.checkedInAt = d;
  }
  if (parsed.data.checkedOutAt) {
    const d = new Date(parsed.data.checkedOutAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: 'Invalid checkedOutAt timestamp' };
    }
    data.checkedOutAt = d;
  }

  // Sanity: checkedOutAt must be after checkedInAt.
  if (
    data.checkedInAt &&
    data.checkedOutAt &&
    (data.checkedOutAt as Date).getTime() < (data.checkedInAt as Date).getTime()
  ) {
    return { ok: false, error: 'Check-out cannot be before check-in' };
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'No changes to save' };
  }

  await prisma.checkInEvent.update({
    where: { id: parsed.data.eventId },
    data,
  });

  revalidatePath(`/w/${workspaceSlug}/timesheets`);
  revalidatePath(`/w/${workspaceSlug}/timesheets/employee`);
  revalidatePath(`/w/${workspaceSlug}/timesheets/sub`);
  return { ok: true };
}

const closeSchema = z.object({
  eventId: z.string().min(1),
});

/**
 * Manually close an open check-in. Sets
 * checkedOutAt = now. Used by the "needs action"
 * banner on the timesheet page.
 */
export async function closeCheckInEventAction(
  workspaceSlug: string,
  _prev: EditResult | undefined,
  formData: FormData,
): Promise<EditResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = closeSchema.safeParse({ eventId: formData.get('eventId') });
  if (!parsed.success) return { ok: false, error: 'Invalid request' };

  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, [...UPDATE_ROLES]);

  const result = await prisma.checkInEvent.updateMany({
    where: { id: parsed.data.eventId, workspaceId: workspace.id },
    data: { checkedOutAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: 'Event not found' };

  revalidatePath(`/w/${workspaceSlug}/timesheets`);
  return { ok: true };
}
