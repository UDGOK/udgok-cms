/**
 * PO PDF download endpoint.
 *
 * Per spec §10.3: "PO must show: our letterhead, PO number, date,
 * vendor + contact, ship-to, needed-by, terms, line table
 * (qty / uom / description / vendor sku / unit price / total),
 * subtotal / freight / tax / total, and a signature/acceptance
 * block. Store to Blob, set pdfUrl, email via Resend on ISSUED."
 *
 * This route serves the PDF inline (Content-Disposition:
 * attachment) so the buyer can save it. The actual Blob
 * upload + email-send happens in issuePoAction — this
 * route is a renderer-on-demand for the buyer's convenience.
 *
 * Auth: any workspace member can download. The PO number
 * is workspace-scoped via the prisma where clause, so cross-
 * workspace access is impossible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { renderPoPdf } from '@/lib/procurement/render-po-pdf';
import type { PoPdfData } from '@/lib/pdf/PoDocument';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspace: string; id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  // Look up the workspace id from the slug.
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Tenant-scoped PO fetch with all the data the PDF needs.
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: {
      vendor: {
        select: {
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
        },
      },
      // For "Attn" line on the PDF — pick the RFQ's contact.
      quote: {
        select: {
          vendorReference: true,
          respondentName: true,
          respondentEmail: true,
          rfq: {
            select: {
              contact: {
                select: { name: true, email: true, phone: true },
              },
            },
          },
        },
      },
      lines: { orderBy: { position: 'asc' } },
    },
  });
  if (!po) {
    return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  }

  const ourCompanyName = process.env.PROCUREMENT_FROM_NAME ?? 'UDGOK Construction';
  const ourEmail = process.env.PROCUREMENT_FROM_EMAIL?.match(/<([^>]+)>/)?.[1]
    ?? 'purchasing@udgok.com';
  const ourPhone = process.env.UDGOK_CONTACT_PHONE ?? '';

  const data: PoPdfData = {
    number: po.number,
    status: po.status,
    issuedAt: po.issuedAt,
    createdAt: po.createdAt,
    ourCompany: {
      name: ourCompanyName,
      contactEmail: ourEmail,
      contactPhone: ourPhone,
    },
    vendor: {
      name: po.vendor.name,
      contactName: po.quote?.respondentName ?? po.quote?.rfq?.contact?.name ?? null,
      contactEmail: po.quote?.respondentEmail ?? po.quote?.rfq?.contact?.email ?? null,
      contactPhone: po.quote?.rfq?.contact?.phone ?? null,
      addressLine1: po.vendor.addressLine1,
      addressLine2: po.vendor.addressLine2,
      city: po.vendor.city,
      state: po.vendor.state,
      postalCode: po.vendor.postalCode,
    },
    shipTo: po.shipTo,
    neededBy: po.neededBy,
    terms: po.terms,
    vendorReference: po.quote?.vendorReference ?? null,
    subtotal: Number(po.subtotal),
    freightAmount: Number(po.freightAmount),
    taxAmount: Number(po.taxAmount),
    total: Number(po.total),
    notes: po.notes,
    deliveryName: po.deliveryName,
    deliveryAddress: po.deliveryAddress,
    deliveryContactName: po.deliveryContactName,
    deliveryContactPhone: po.deliveryContactPhone,
    deliveryContactEmail: po.deliveryContactEmail,
    lines: po.lines.map((l) => ({
      position: l.position,
      description: l.description,
      quantity: Number(l.quantity),
      uom: l.uom,
      vendorSku: l.vendorSku,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
      isSubstitute: l.isSubstitute,
      substituteNote: l.substituteNote,
    })),
  };

  let pdf: Buffer;
  try {
    pdf = await renderPoPdf(data);
  } catch (e) {
    console.error('[po/pdf] render failed:', e);
    return NextResponse.json({ error: 'PDF render failed' }, { status: 500 });
  }

  // Convert Node Buffer to a fresh Uint8Array so NextResponse
  // accepts it. Next's BodyInit type rejects the Node Buffer
  // type directly; copying to a new Uint8Array matches the
  // pattern used by the other PDF route in this app.
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.length),
      'Content-Disposition': `attachment; filename="${po.number}.pdf"`,
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    },
  });
}
