/**
 * RFQ queries — workspace-scoped reads.
 */

import { prisma } from '@/lib/db/client';

export interface RfqSummary {
  id: string;
  number: string;
  status: string;
  vendor: { id: string; name: string };
  listId: string;
  listName: string;
  sentToEmail: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  expiresAt: Date;
  firstViewedAt: Date | null;
  total: number | null; // from latest SUBMITTED quote
  hasAcceptedPo: boolean;
}

export async function listRfqsForList(
  workspaceId: string,
  listId: string,
): Promise<RfqSummary[]> {
  const rows = await prisma.rfq.findMany({
    where: { workspaceId, listId },
    orderBy: { createdAt: 'desc' },
    include: {
      vendor: { select: { id: true, name: true } },
      list: { select: { id: true, name: true } },
      quotes: {
        where: { status: 'SUBMITTED' },
        orderBy: { revision: 'desc' },
        take: 1,
        select: { total: true, po: { select: { id: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    vendor: r.vendor,
    listId: r.listId,
    listName: r.list.name,
    sentToEmail: r.sentToEmail,
    sentAt: r.sentAt,
    respondedAt: r.respondedAt,
    expiresAt: r.expiresAt,
    firstViewedAt: r.firstViewedAt,
    total: r.quotes[0]?.total ? Number(r.quotes[0].total) : null,
    hasAcceptedPo: !!r.quotes[0]?.po,
  }));
}

export interface RfqDetail {
  id: string;
  number: string;
  status: string;
  vendor: { id: string; name: string; defaultTerms: string | null };
  contact: { id: string; name: string; email: string } | null;
  listId: string;
  listName: string;
  listDeliverTo: string | null;
  listNeededBy: Date | null;
  message: string | null;
  neededBy: Date | null;
  tokenHash: string;
  tokenPrefix: string;
  sentAt: Date | null;
  firstViewedAt: Date | null;
  lastViewedAt: Date | null;
  respondedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  sentToEmail: string | null;
  createdAt: Date;
  events: Array<{
    id: string;
    type: string;
    actor: string | null;
    createdAt: Date;
    meta: unknown;
  }>;
  quotes: Array<{
    id: string;
    revision: number;
    status: string;
    submittedAt: Date;
    total: number;
    subtotal: number;
    taxAmount: number;
    freightAmount: number;
    leadTimeDays: number | null;
    terms: string | null;
    notes: string | null;
    respondentName: string | null;
    respondentEmail: string | null;
    vendorReference: string | null;
    attachmentName: string | null;
    lines: Array<{
      id: string;
      position: number;
      description: string;
      quantity: number;
      uom: string;
      vendorSku: string | null;
      unitPrice: number | null;
      lineTotal: number | null;
      available: boolean;
      leadTimeDays: number | null;
      isSubstitute: boolean;
      substituteNote: string | null;
      notes: string | null;
    }>;
  }>;
  po: {
    id: string;
    number: string;
    status: string;
    total: number;
  } | null;
}

export async function getRfqDetail(workspaceId: string, rfqId: string): Promise<RfqDetail | null> {
  const r = await prisma.rfq.findFirst({
    where: { id: rfqId, workspaceId },
    include: {
      vendor: { select: { id: true, name: true, defaultTerms: true } },
      contact: { select: { id: true, name: true, email: true } },
      list: { select: { id: true, name: true, deliverTo: true, neededBy: true } },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, type: true, actor: true, createdAt: true, meta: true },
      },
      quotes: {
        orderBy: { revision: 'desc' },
        include: {
          lines: { orderBy: { position: 'asc' } },
          po: { select: { id: true, number: true, status: true, total: true } },
        },
      },
    },
  });
  if (!r) return null;
  // Pick the latest SUBMITTED quote's PO. Earlier revisions
  // are SUPERSEDED, so even if the buyer accepted an older
  // revision, it must show the same PO.
  const acceptedQuote = r.quotes.find((q) => q.po)?.po ?? null;
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    vendor: r.vendor,
    contact: r.contact,
    listId: r.listId,
    listName: r.list.name,
    listDeliverTo: r.list.deliverTo,
    listNeededBy: r.list.neededBy,
    message: r.message,
    neededBy: r.neededBy,
    tokenHash: r.tokenHash,
    tokenPrefix: r.tokenPrefix,
    sentAt: r.sentAt,
    firstViewedAt: r.firstViewedAt,
    lastViewedAt: r.lastViewedAt,
    respondedAt: r.respondedAt,
    revokedAt: r.revokedAt,
    expiresAt: r.expiresAt,
    sentToEmail: r.sentToEmail,
    createdAt: r.createdAt,
    events: r.events,
    quotes: r.quotes.map((q) => ({
      id: q.id,
      revision: q.revision,
      status: q.status,
      submittedAt: q.submittedAt,
      total: Number(q.total),
      subtotal: Number(q.subtotal),
      taxAmount: Number(q.taxAmount),
      freightAmount: Number(q.freightAmount),
      leadTimeDays: q.leadTimeDays,
      terms: q.terms,
      notes: q.notes,
      respondentName: q.respondentName,
      respondentEmail: q.respondentEmail,
      vendorReference: q.vendorReference,
      attachmentName: q.attachmentName,
      lines: q.lines.map((l) => ({
        id: l.id,
        position: l.position,
        description: l.description,
        quantity: Number(l.quantity),
        uom: l.uom,
        vendorSku: l.vendorSku,
        unitPrice: l.unitPrice ? Number(l.unitPrice) : null,
        lineTotal: l.lineTotal ? Number(l.lineTotal) : null,
        available: l.available,
        leadTimeDays: l.leadTimeDays,
        isSubstitute: l.isSubstitute,
        substituteNote: l.substituteNote,
        notes: l.notes,
      })),
    })),
    po: acceptedQuote
      ? {
          id: acceptedQuote.id,
          number: acceptedQuote.number,
          status: acceptedQuote.status,
          total: Number(acceptedQuote.total),
        }
      : null,
  };
}
