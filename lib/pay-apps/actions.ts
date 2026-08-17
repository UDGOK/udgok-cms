'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { auth } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkspace } from '@/lib/workspace/get-workspace';
import { Resend } from 'resend';

const generateSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  thisDraws: z.record(z.string(), z.coerce.number().min(0).default(0)),
  notes: z.string().max(4000).optional(),
});

export type GeneratePayAppState =
  | { error?: string; fieldErrors?: Record<string, string>; id?: string }
  | undefined;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function generateShareToken() {
  return randomBytes(24).toString('base64url');
}

export async function generatePayAppAction(
  workspaceSlug: string,
  projectId: string,
  _prev: GeneratePayAppState,
  formData: FormData,
): Promise<GeneratePayAppState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: {
      divisions: { orderBy: { sortOrder: 'asc' } },
      payApps: { orderBy: { drawNumber: 'desc' }, take: 1, include: { divisions: true } },
    },
  });
  if (!project) return { error: 'Project not found' };
  if (project.divisions.length === 0) {
    return { error: 'Project needs at least one division before you can generate a pay app.' };
  }

  // Build the map of thisDraw amounts from the form
  const thisDraws: Record<string, number> = {};
  for (const div of project.divisions) {
    const raw = formData.get(`thisDraw_${div.id}`);
    const val = raw == null || raw === '' ? 0 : Number(raw);
    if (Number.isNaN(val) || val < 0) {
      return { error: `Invalid amount for ${div.trade}` };
    }
    thisDraws[div.id] = val;
  }

  const parsed = generateSchema.safeParse({
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
    thisDraws,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Determine previous cumulative billed per division from prior pay apps
  const lastPayApp = project.payApps[0];
  const lastLines = lastPayApp?.divisions ?? [];
  const totalContract = project.divisions.reduce((acc, d) => acc + Number(d.budget), 0);

  // Build PayAppDivision rows
  const lines = project.divisions.map((div, i) => {
    const prev = lastLines.find((l) => l.projectDivisionId === div.id);
    const previousAmount = prev ? Number(prev.balanceAfter) : 0;
    const thisDraw = thisDraws[div.id] ?? 0;
    const balanceAfter = Number(div.budget) - previousAmount - thisDraw;
    return {
      projectDivisionId: div.id,
      previousAmount,
      thisDrawAmount: thisDraw,
      balanceAfter: Math.max(balanceAfter, 0),
      sortOrder: div.sortOrder || i,
    };
  });

  const totalPrevious = lines.reduce((acc, l) => acc + l.previousAmount, 0);
  const totalThisDraw = lines.reduce((acc, l) => acc + l.thisDrawAmount, 0);
  const totalBalance = totalContract - totalPrevious - totalThisDraw;

  const nextDrawNumber = (lastPayApp?.drawNumber ?? 0) + 1;

  const payApp = await prisma.payApp.create({
    data: {
      projectId,
      drawNumber: nextDrawNumber,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      status: 'DRAFT',
      totalContract,
      totalPrevious,
      totalThisDraw,
      totalBalance,
      notes: parsed.data.notes,
      shareToken: generateShareToken(),
      createdById: userId,
      divisions: {
        create: lines,
      },
    },
    select: { id: true, shareToken: true },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/pay-apps/${payApp.id}`);
  return { id: payApp.id };
}

const sendSchema = z.object({
  payAppId: z.string(),
  to: z.string().email(),
  fromName: z.string().min(1).max(80).default('UDGOK Construction'),
});

export type SendPayAppState = { error?: string; ok?: boolean } | undefined;

export async function sendPayAppAction(
  workspaceSlug: string,
  projectId: string,
  _prev: SendPayAppState,
  formData: FormData,
): Promise<SendPayAppState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const parsed = sendSchema.safeParse({
    payAppId: formData.get('payAppId'),
    to: formData.get('to'),
    fromName: formData.get('fromName') || 'UDGOK Construction',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const payApp = await prisma.payApp.findFirst({
    where: { id: parsed.data.payAppId, projectId },
    include: { project: { include: { client: true } } },
  });
  if (!payApp) return { error: 'Pay app not found' };
  if (payApp.status !== 'DRAFT' && payApp.status !== 'SENT') {
    return { error: `Cannot send a pay app in status ${payApp.status}` };
  }

  // Send via Resend
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!apiKey || !fromAddress) {
    // We still update the status; just skip sending in this environment.
    console.warn('[sendPayApp] RESEND_API_KEY not set; marking SENT but skipping email send');
  } else {
    const resend = new Resend(apiKey);
    const url = `${APP_URL}/pay-apps/${payApp.shareToken}`;
    try {
      await resend.emails.send({
        from: `${parsed.data.fromName} <${fromAddress}>`,
        to: parsed.data.to,
        subject: `Pay Application #${payApp.drawNumber} — ${payApp.project.name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto;">
            <h1 style="font-size: 22px; margin-bottom: 8px;">Pay Application #${payApp.drawNumber}</h1>
            <p>${payApp.project.name} — ${payApp.project.client?.name ?? ''}</p>
            <p>Period: ${payApp.periodStart.toLocaleDateString()} – ${payApp.periodEnd.toLocaleDateString()}</p>
            <p style="font-size: 28px; font-weight: 900; margin: 24px 0;">
              This draw: $${Number(payApp.totalThisDraw).toLocaleString()}
            </p>
            <a href="${url}" style="display: inline-block; background: #f06a2d; color: white; padding: 14px 24px; text-decoration: none; font-weight: 700; text-transform: uppercase;">
              Review & approve →
            </a>
            <p style="margin-top: 24px; font-size: 12px; color: #666;">
              This is a private link. Please don't share.
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error('[sendPayApp] Resend error', err);
      return { error: 'Email failed to send. Check RESEND_API_KEY and try again.' };
    }
  }

  await prisma.payApp.update({
    where: { id: payApp.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      sentToEmail: parsed.data.to,
    },
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/pay-apps/${payApp.id}`);
  return { ok: true };
}

export async function acknowledgePayAppAction(workspaceSlug: string, projectId: string, payAppId: string) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const payApp = await prisma.payApp.findFirst({ where: { id: payAppId, projectId } });
  if (!payApp) return { error: 'Not found' };
  await prisma.payApp.update({
    where: { id: payAppId },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
  });
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/pay-apps/${payAppId}`);
  return { ok: true };
}

export async function markPayAppPaidAction(workspaceSlug: string, projectId: string, payAppId: string) {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };
  const workspace = await getWorkspace(workspaceSlug);
  await requireRole(workspace.id, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR']);

  const payApp = await prisma.payApp.findFirst({ where: { id: payAppId, projectId } });
  if (!payApp) return { error: 'Not found' };
  await prisma.payApp.update({
    where: { id: payAppId },
    data: { status: 'PAID' },
  });
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/pay-apps/${payAppId}`);
  return { ok: true };
}
