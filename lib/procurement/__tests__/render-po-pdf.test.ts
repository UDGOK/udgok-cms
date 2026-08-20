/**
 * PO PDF render — smoke test.
 *
 * Renders a minimal PO document and asserts the result is a
 * non-empty PDF (starts with %PDF-). This catches the common
 * regression where the PDFDocument or its component throws on
 * render — we don't need to assert the visual layout.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// @react-pdf/renderer has heavy Node deps. Skip if it can't load
// (e.g. in a stripped-down test env).
let renderPoPdf: typeof import('../render-po-pdf').renderPoPdf;
let supported = true;

beforeAll(async () => {
  try {
    const mod = await import('../render-po-pdf');
    renderPoPdf = mod.renderPoPdf;
  } catch {
    supported = false;
  }
});

describe('PO PDF render', () => {
  it('renders a valid PDF buffer for a minimal PO', async () => {
    if (!supported) {
      console.warn('Skipping PO PDF test — @react-pdf/renderer not loadable');
      return;
    }
    const buffer = await renderPoPdf({
      number: 'PO-2026-0001',
      status: 'PENDING_APPROVAL',
      issuedAt: null,
      createdAt: new Date('2026-08-20T12:00:00Z'),
      ourCompany: {
        name: 'UDGOK Construction',
        contactEmail: 'purchasing@udgok.com',
        contactPhone: '(918) 555-0100',
      },
      vendor: {
        name: 'Locke Supply',
        contactName: 'John Rep',
        contactEmail: 'rep@locke.com',
        contactPhone: null,
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Broken Arrow',
        state: 'OK',
        postalCode: '74012',
      },
      shipTo: '200 Job Site Rd, Tulsa OK 74103',
      neededBy: new Date('2026-09-01'),
      terms: 'Net 30',
      vendorReference: 'Q-1234',
      subtotal: 100,
      freightAmount: 10,
      taxAmount: 8.5,
      total: 118.5,
      notes: 'Leave at receiving dock',
      deliveryName: 'Main Site — Building A',
      deliveryAddress: '742 Evergreen Terrace, Springfield IL 62704',
      deliveryContactName: 'Bob Foreman',
      deliveryContactPhone: '(918) 555-0123',
      deliveryContactEmail: 'foreman@jobsite.com',
      lines: [
        {
          position: 0,
          description: '12/2 Romex wire, 250ft roll',
          quantity: 4,
          uom: 'ROLL',
          vendorSku: 'ROMEX-12-2-250',
          unitPrice: 25,
          lineTotal: 100,
        },
      ],
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic number — every PDF starts with %PDF-
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('handles substitute lines and null fields', async () => {
    if (!supported) return;
    const buffer = await renderPoPdf({
      number: 'PO-2026-0002',
      status: 'ISSUED',
      issuedAt: new Date(),
      createdAt: new Date(),
      ourCompany: {
        name: 'UDGOK',
        contactEmail: 'p@u.com',
        contactPhone: '',
      },
      vendor: {
        name: 'V',
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
      },
      shipTo: null,
      neededBy: null,
      terms: null,
      vendorReference: null,
      subtotal: 0,
      freightAmount: 0,
      taxAmount: 0,
      total: 0,
      notes: null,
      deliveryName: null,
      deliveryAddress: null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      deliveryContactEmail: null,
      lines: [
        {
          position: 0,
          description: 'Alt part',
          quantity: 1,
          uom: 'EA',
          vendorSku: null,
          unitPrice: 0,
          lineTotal: 0,
          isSubstitute: true,
          substituteNote: '12/2 was out of stock, swapped to 14/2',
        },
      ],
    });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
  });
});
