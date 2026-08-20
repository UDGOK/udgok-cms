/**
 * PO PDF render entry point.
 *
 * Used by the download route and the issue-time email.
 * Server-only — must not be imported from a 'use client'
 * file (the @react-pdf/renderer lib uses Node primitives).
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { PoDocument, type PoPdfData } from '@/lib/pdf/PoDocument';

export async function renderPoPdf(data: PoPdfData): Promise<Buffer> {
  return renderToBuffer(<PoDocument data={data} />);
}
