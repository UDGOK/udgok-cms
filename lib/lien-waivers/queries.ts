/**
 * Lien Waiver queries.
 *
 * Read paths for LWs. Writes are in ./actions.ts.
 *
 * The public share token lookup is a separate function
 * (`getLienWaiverByToken`) that doesn't check the workspace,
 * because the share token IS the credential.
 */

import { prisma } from '@/lib/db/client';

export interface LienWaiverListItem {
  id: string;
  number: string;
  type: string;
  status: string;
  amountCents: number;
  throughDate: Date;
  signedAt: Date | null;
  signerName: string | null;
  subcontractorName: string | null;
  payAppNumber: number | null;
  createdAt: Date;
}

export async function listLienWaivers(
  projectId: string,
  workspaceId: string,
): Promise<LienWaiverListItem[]> {
  const rows = await prisma.lienWaiver.findMany({
    where: { projectId, workspaceId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      amountCents: true,
      throughDate: true,
      signedAt: true,
      signerName: true,
      subcontractor: { select: { name: true } },
      payApp: { select: { drawNumber: true } },
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    status: r.status,
    amountCents: Number(r.amountCents),
    throughDate: r.throughDate,
    signedAt: r.signedAt,
    signerName: r.signerName,
    subcontractorName: r.subcontractor?.name ?? null,
    payAppNumber: r.payApp?.drawNumber ?? null,
    createdAt: r.createdAt,
  }));
}

export interface LienWaiverDetail extends LienWaiverListItem {
  projectName: string;
  workspaceName: string;
  exceptionText: string | null;
  signerTitle: string | null;
  signerEmail: string | null;
  signatureMethod: string | null;
  pdfUrl: string | null;
  events: Array<{
    id: string;
    type: string;
    actor: string;
    createdAt: Date;
  }>;
}

/** Authenticated read (requires workspace membership). */
export async function getLienWaiver(
  waiverId: string,
  workspaceId: string,
): Promise<LienWaiverDetail | null> {
  const w = await prisma.lienWaiver.findFirst({
    where: { id: waiverId, workspaceId },
    include: {
      project: { select: { name: true, workspace: { select: { name: true } } } },
      subcontractor: { select: { name: true } },
      payApp: { select: { drawNumber: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!w) return null;
  return {
    id: w.id,
    number: w.number,
    type: w.type,
    status: w.status,
    amountCents: Number(w.amountCents),
    throughDate: w.throughDate,
    signedAt: w.signedAt,
    signerName: w.signerName,
    subcontractorName: w.subcontractor?.name ?? null,
    payAppNumber: w.payApp?.drawNumber ?? null,
    createdAt: w.createdAt,
    projectName: w.project.name,
    workspaceName: w.project.workspace.name,
    exceptionText: w.exceptionText,
    signerTitle: w.signerTitle,
    signerEmail: w.signerEmail,
    signatureMethod: w.signatureMethod,
    pdfUrl: w.pdfUrl,
    events: w.events.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      createdAt: e.createdAt,
    })),
  };
}

export interface LienWaiverByToken {
  id: string;
  number: string;
  type: string;
  status: string;
  amountCents: number;
  throughDate: Date;
  exceptionText: string | null;
  projectName: string;
  workspaceName: string;
  subcontractorName: string | null;
  payAppNumber: number | null;
  signedAt: Date | null;
}

/** Public read by share token. No workspace check. */
export async function getLienWaiverByToken(
  token: string,
): Promise<LienWaiverByToken | null> {
  const w = await prisma.lienWaiver.findUnique({
    where: { shareToken: token },
    include: {
      project: { select: { name: true, workspace: { select: { name: true } } } },
      subcontractor: { select: { name: true } },
      payApp: { select: { drawNumber: true } },
    },
  });
  if (!w) return null;
  return {
    id: w.id,
    number: w.number,
    type: w.type,
    status: w.status,
    amountCents: Number(w.amountCents),
    throughDate: w.throughDate,
    exceptionText: w.exceptionText,
    projectName: w.project.name,
    workspaceName: w.project.workspace.name,
    subcontractorName: w.subcontractor?.name ?? null,
    payAppNumber: w.payApp?.drawNumber ?? null,
    signedAt: w.signedAt,
  };
}

export async function trackLienWaiverView(waiverId: string): Promise<void> {
  try {
    await prisma.lienWaiver.updateMany({
      where: { id: waiverId, firstViewedAt: null },
      data: { firstViewedAt: new Date(), viewCount: { increment: 1 } },
    });
    await prisma.lienWaiver.updateMany({
      where: { id: waiverId, NOT: { firstViewedAt: null } },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Best-effort
  }
}
