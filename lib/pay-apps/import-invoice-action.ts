'use server';

/**
 * Import-invoice action.
 *
 * One-click way to populate a project's pay apps from an
 * invoice (PDF or paper) that the buyer already has. Used
 * for the PFG — Grove scenario (paid invoice + future
 * pay app for unpaid work) and any future invoice import.
 *
 * What it does, in one $transaction:
 *   1. Validates the project exists in the workspace
 *   2. Ensures ProjectDivision rows exist for each
 *      invoice line (matched by CSI code)
 *   3. Creates the PayApp with status (PAID/DRAFT/SENT),
 *      payment date, and the right total fields
 *   4. Creates the PayAppDivision rows
 *
 * Idempotent: if a draw with the same number already
 * exists, the action returns a clear error instead of
 * creating a duplicate. Use a different drawNumber to
 * re-import.
 */

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import type { ActionResult } from '@/lib/procurement/types';

const importSchema = z.object({
  projectId: z.string().min(1),
  // The draw number this invoice represents. Must be
  // unique on the project. If a draw with this number
  // already exists, the action returns an error and
  // suggests the next free draw number.
  drawNumber: z.coerce.number().int().min(1),
  status: z.enum(['DRAFT', 'SENT', 'PAID']),
  invoiceNumber: z.string().min(1).max(80),
  invoiceDate: z.coerce.date(),
  paymentDate: z.coerce.date(),
  // Client who paid / will pay. Used for the sentToEmail
  // and acknowledgedBy fields on the PayApp.
  clientEmail: z.string().email().optional(),
  clientName: z.string().max(120).optional(),
  // If totalContract is omitted, we use the sum of line
  // amounts. The buyer can override after import.
  totalContract: z.coerce.number().min(0).optional(),
  notes: z.string().max(4000).optional(),
  // The line items — each is a (code, trade, amount)
  // tuple. Codes match (or create) ProjectDivision.code.
  lines: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        trade: z.string().min(1).max(120),
        amount: z.coerce.number().min(0).max(10_000_000),
      }),
    )
    .min(1)
    .max(50),
});

export type ImportInvoiceInput = z.infer<typeof importSchema>;

/**
 * Public entrypoint. Use this from a client component.
 * Requires OWNER | ADMIN | PM (same as the other pay
 * app actions).
 */
export async function importInvoiceAction(
  workspaceSlug: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ payAppId: string; drawNumber: number; divisionCount: number }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  // Find the workspace from the slug (the caller passes slug).
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  });
  if (!workspace) return { ok: false, error: 'Workspace not found' };

  try {
    await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Missing payload' };
  }
  let parsed: ImportInvoiceInput;
  try {
    parsed = importSchema.parse(JSON.parse(raw));
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Invalid payload',
    };
  }

  // Verify the project belongs to this workspace. The
  // tenant-scope is critical — never trust the projectId
  // from the client.
  const project = await prisma.project.findFirst({
    where: { id: parsed.projectId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!project) return { ok: false, error: 'Project not found' };

  // Refuse if a draw with this number already exists.
  // The buyer can use a different drawNumber to re-import.
  const existing = await prisma.payApp.findFirst({
    where: { projectId: project.id, drawNumber: parsed.drawNumber },
    select: { id: true, status: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `Draw #${parsed.drawNumber} already exists on ${project.name} (status: ${existing.status}). Use a different draw number to re-import, or delete the existing draw first.`,
    };
  }

  // Compute totals. totalContract defaults to the sum of
  // line amounts; the buyer can override after import.
  const sumLines = parsed.lines.reduce((a, l) => a + l.amount, 0);
  const totalContract = parsed.totalContract ?? sumLines;
  const totalThisDraw = sumLines;
  // For a single import, totalPrevious = 0. The buyer can
  // reconcile this in the UI after importing multiple draws.
  const totalPrevious = 0;
  // For PAID status, balance = 0 (paid in full). For others,
  // balance = contract - previous - thisDraw.
  const totalBalance = parsed.status === 'PAID' ? 0 : totalContract - totalPrevious - totalThisDraw;

  // Transactional create: ensure divisions, create pay
  // app, create division lines. If anything throws, the
  // whole thing rolls back.
  const result = await prisma.$transaction(async (tx) => {
    // 1. Ensure ProjectDivision rows. We match by code
    //    (CSI code like "04", "06", "07"). If a division
    //    with that code exists on the project, reuse it.
    const divisionByCode = new Map<string, string>();
    let nextSortOrder = await tx.projectDivision.count({ where: { projectId: project.id } });

    for (const line of parsed.lines) {
      const existing = await tx.projectDivision.findFirst({
        where: { projectId: project.id, code: line.code },
        select: { id: true },
      });
      if (existing) {
        divisionByCode.set(line.code, existing.id);
      } else {
        const created = await tx.projectDivision.create({
          data: {
            projectId: project.id,
            code: line.code,
            trade: line.trade,
            budget: 0, // buyer sets budgets in the UI after import
            sortOrder: nextSortOrder++,
          },
          select: { id: true },
        });
        divisionByCode.set(line.code, created.id);
      }
    }

    // 2. Create the PayApp. The period covers invoice
    //    date → payment date (when the work was done and
    //    when the money moved).
    const payApp = await tx.payApp.create({
      data: {
        projectId: project.id,
        drawNumber: parsed.drawNumber,
        periodStart: parsed.invoiceDate,
        periodEnd: parsed.paymentDate,
        status: parsed.status,
        totalContract,
        totalPrevious,
        totalThisDraw,
        totalBalance,
        notes:
          (parsed.notes ?? '') +
          (parsed.notes ? '\n\n' : '') +
          `Imported from invoice ${parsed.invoiceNumber} (issued ${parsed.invoiceDate.toISOString().slice(0, 10)}).`,
        shareToken: randomBytes(24).toString('base64url'),
        // For PAID status, stamp the lifecycle fields so
        // the audit trail shows when each event happened.
        sentAt: parsed.invoiceDate,
        sentToEmail: parsed.clientEmail ?? null,
        acknowledgedAt: parsed.status === 'PAID' ? parsed.paymentDate : null,
        acknowledgedByEmail: parsed.status === 'PAID' ? parsed.clientEmail ?? null : null,
        acknowledgedByName: parsed.status === 'PAID' ? parsed.clientName ?? null : null,
        firstViewedAt: parsed.status === 'PAID' ? parsed.paymentDate : null,
        viewCount: parsed.status === 'PAID' ? 1 : 0,
        createdById: userId,
      },
      select: { id: true },
    });

    // 3. Create the PayAppDivision lines. previousAmount
    //    is 0 (first time this division is billed) and
    //    balanceAfter is 0 for PAID, full amount otherwise.
    let sortOrder = 0;
    for (const line of parsed.lines) {
      const divisionId = divisionByCode.get(line.code);
      if (!divisionId) {
        throw new Error(`Internal error: division ${line.code} not in map`);
      }
      await tx.payAppDivision.create({
        data: {
          payAppId: payApp.id,
          projectDivisionId: divisionId,
          previousAmount: 0,
          thisDrawAmount: new Prisma.Decimal(line.amount),
          balanceAfter:
            parsed.status === 'PAID' ? new Prisma.Decimal(0) : new Prisma.Decimal(line.amount),
          sortOrder: sortOrder++,
        },
      });
    }

    return { payAppId: payApp.id, divisionCount: parsed.lines.length };
  }).catch((e) => {
    return { __error: e instanceof Error ? e.message : 'Import failed' };
  });

  if ('__error' in result) {
    return { ok: false, error: result.__error };
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${parsed.projectId}/pay-apps`);
  revalidatePath(`/w/${workspaceSlug}/projects/${parsed.projectId}`);

  return {
    ok: true,
    payAppId: result.payAppId,
    drawNumber: parsed.drawNumber,
    divisionCount: result.divisionCount,
  };
}
