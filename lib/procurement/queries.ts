/**
 * Procurement queries — workspace-scoped read paths.
 *
 * Every function in this file takes a workspaceId as its
 * first argument. The Prisma `where` always includes it.
 * Tenant-scoped reads are not exposed to the public vendor
 * portal (that path lives under app/q/ and app/api/q/).
 */

import { prisma } from '@/lib/db/client';

export interface VendorListItem {
  id: string;
  name: string;
  legalName: string | null;
  capability: string;
  status: string;
  contactCount: number;
  quoteCount: number;
  poCount: number;
  lastQuotedAt: Date | null;
  createdAt: Date;
}

export async function listVendors(workspaceId: string): Promise<VendorListItem[]> {
  const rows = await prisma.vendor.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          contacts: { where: {} as never },
          quotes: true,
          pos: true,
        },
      },
      quotes: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
        select: { submittedAt: true },
      },
    },
  });
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    legalName: v.legalName,
    capability: v.capability,
    status: v.status,
    contactCount: v._count.contacts,
    quoteCount: v._count.quotes,
    poCount: v._count.pos,
    lastQuotedAt: v.quotes[0]?.submittedAt ?? null,
    createdAt: v.createdAt,
  }));
}

export interface VendorDetail {
  id: string;
  name: string;
  legalName: string | null;
  accountNumber: string | null;
  capability: string;
  status: string;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  defaultTerms: string | null;
  taxExempt: boolean;
  notes: string | null;
  subcontractorId: string | null;
  contacts: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string | null;
    isPrimary: boolean;
  }>;
  recentQuotes: Array<{
    id: string;
    number: string | null;
    status: string;
    total: number;
    submittedAt: Date;
    rfqNumber: string;
  }>;
  recentPos: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    issuedAt: Date | null;
  }>;
  createdAt: Date;
}

export async function getVendorDetail(
  workspaceId: string,
  vendorId: string,
): Promise<VendorDetail | null> {
  const v = await prisma.vendor.findFirst({
    where: { id: vendorId, workspaceId, deletedAt: null },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      quotes: {
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: {
          rfq: { select: { number: true } },
        },
      },
      pos: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!v) return null;
  return {
    id: v.id,
    name: v.name,
    legalName: v.legalName,
    accountNumber: v.accountNumber,
    capability: v.capability,
    status: v.status,
    phone: v.phone,
    website: v.website,
    addressLine1: v.addressLine1,
    addressLine2: v.addressLine2,
    city: v.city,
    state: v.state,
    postalCode: v.postalCode,
    defaultTerms: v.defaultTerms,
    taxExempt: v.taxExempt,
    notes: v.notes,
    subcontractorId: v.subcontractorId,
    contacts: v.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: c.role,
      isPrimary: c.isPrimary,
    })),
    recentQuotes: v.quotes.map((q) => ({
      id: q.id,
      number: q.id, // number lives on the parent RFQ; not stored on quote
      status: q.status,
      total: Number(q.total),
      submittedAt: q.submittedAt,
      rfqNumber: q.rfq.number,
    })),
    recentPos: v.pos.map((p) => ({
      id: p.id,
      number: p.number,
      status: p.status,
      total: Number(p.total),
      issuedAt: p.issuedAt,
    })),
    createdAt: v.createdAt,
  };
}

/** Lightweight list of contacts for a vendor — used in the
 *  RFQ send picker so the admin can pick a recipient. */
export async function listVendorContacts(
  workspaceId: string,
  vendorId: string,
) {
  return prisma.vendorContact.findMany({
    where: { workspaceId, vendorId },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isPrimary: true,
    },
  });
}

/** Vendor option list for the MaterialList/RFQ selectors.
 *  Returns the minimal { id, name } so the dropdown is
 *  fast even with hundreds of vendors. */
export async function listVendorOptions(workspaceId: string) {
  return prisma.vendor.findMany({
    where: { workspaceId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, defaultTerms: true },
  });
}
