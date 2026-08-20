/**
 * PO document — single-page PDF for a purchase order.
 *
 * Layout (per spec §10.3):
 *   - Letterhead (UDGOK Construction / contact)
 *   - PO number, date, status badge
 *   - Vendor + contact
 *   - Ship-to, needed-by, terms
 *   - Line table (qty / uom / description / vendor sku / unit / total)
 *   - Subtotal / freight / tax / total
 *   - Signature/acceptance block
 *
 * Uses the same Atelier design tokens as the project-book PDF
 * so the printed page looks like it came from the app.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { colors, font } from './styles';

export interface PoPdfLine {
  position: number;
  description: string;
  quantity: number;
  uom: string;
  vendorSku: string | null;
  unitPrice: number;
  lineTotal: number;
  isSubstitute?: boolean;
  substituteNote?: string | null;
}

export interface PoPdfData {
  number: string;
  status: string;
  issuedAt: Date | null;
  createdAt: Date;
  ourCompany: {
    name: string;
    contactEmail: string;
    contactPhone: string;
  };
  vendor: {
    name: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  };
  shipTo: string | null;
  neededBy: Date | null;
  terms: string | null;
  vendorReference: string | null;
  subtotal: number;
  freightAmount: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  // Delivery block (where the driver physically drops off,
  // plus the on-site receiver). Separate from shipTo which
  // is the buyer's general destination. The driver needs
  // both pieces of info printed clearly on the PO.
  deliveryName: string | null;
  deliveryAddress: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryContactEmail: string | null;
  lines: PoPdfLine[];
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    paddingHorizontal: 54, // 0.75" margin
    paddingVertical: 54,
    fontFamily: font.body,
    fontSize: 10,
    color: colors.ink,
  },
  // Letterhead
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  brand: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 22,
    fontFamily: font.headlineBold,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 8,
    color: colors.ink70,
    marginTop: 2,
    fontFamily: font.mono,
    letterSpacing: 0.5,
  },
  poNumber: {
    alignItems: 'flex-end',
  },
  poNumberLabel: {
    fontSize: 8,
    fontFamily: font.mono,
    color: colors.ink50,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  poNumberValue: {
    fontSize: 16,
    fontFamily: font.headlineBold,
    color: colors.ink,
  },
  statusPill: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.orange,
    color: colors.paper,
    fontSize: 8,
    fontFamily: font.monoBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Two-column meta block
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: font.mono,
    color: colors.ink50,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    color: colors.ink,
  },
  metaSub: {
    fontSize: 9,
    color: colors.ink70,
    marginTop: 1,
  },
  // Line table
  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    color: colors.paper,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeadCell: {
    fontSize: 7,
    fontFamily: font.monoBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: colors.paper2,
  },
  cellDesc: { flex: 1, paddingRight: 8 },
  cellQty: { width: 50, textAlign: 'right' },
  cellUom: { width: 35, textAlign: 'left' },
  cellSku: { width: 80, textAlign: 'left' },
  cellUnit: { width: 60, textAlign: 'right' },
  cellTotal: { width: 70, textAlign: 'right' },
  cellDescText: { fontSize: 9.5, color: colors.ink, fontFamily: font.bodyBold },
  cellSubText: { fontSize: 8, color: colors.warning, marginTop: 1 },
  cellMono: { fontSize: 9, color: colors.ink, fontFamily: font.mono },
  // Totals
  totalsBlock: {
    marginTop: 18,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 9,
    color: colors.ink70,
    fontFamily: font.mono,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  totalsValue: {
    fontSize: 10,
    fontFamily: font.mono,
    color: colors.ink,
  },
  totalsRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  totalsLabelGrand: {
    fontSize: 11,
    fontFamily: font.headlineBold,
    color: colors.ink,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  totalsValueGrand: {
    fontSize: 14,
    fontFamily: font.headlineBold,
    color: colors.ink,
  },
  // Notes
  notesBlock: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
  },
  notesLabel: {
    fontSize: 7,
    fontFamily: font.mono,
    color: colors.ink50,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: colors.ink70,
    lineHeight: 1.4,
  },
  // Signature
  signatureBlock: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 24,
  },
  signatureCol: {
    flex: 1,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: colors.ink,
    marginTop: 32,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    fontFamily: font.mono,
    color: colors.ink50,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 54,
    right: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: colors.ink50,
    fontFamily: font.mono,
    letterSpacing: 0.5,
  },
  // Delivery block — distinct from the meta row above. Uses
  // a left orange accent so the driver (looking at the printed
  // PO in the cab of the truck) sees the drop-off + on-site
  // PoC without scanning the whole document.
  deliveryBlock: {
    marginTop: 12,
    marginBottom: 12,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
    backgroundColor: colors.paper2,
  },
  deliveryHeader: {
    fontSize: 8,
    fontFamily: font.bodyBold,
    color: colors.ink,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  deliveryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deliveryCol: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 6.5,
    fontFamily: font.bodyBold,
    color: colors.ink50,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  deliveryValue: {
    fontSize: 9,
    fontFamily: font.bodyBold,
    color: colors.ink,
  },
  deliverySub: {
    fontSize: 8,
    fontFamily: font.mono,
    color: colors.ink70,
    marginTop: 1,
  },
});

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

function poStatusColor(status: string): string {
  switch (status) {
    case 'ISSUED':
    case 'ACKNOWLEDGED':
      return colors.info ?? colors.orange;
    case 'PENDING_APPROVAL':
      return colors.warning;
    case 'RECEIVED':
    case 'CLOSED':
      return colors.success;
    case 'CANCELLED':
      return colors.ink50;
    default:
      return colors.orange;
  }
}

export function PoDocument({ data }: { data: PoPdfData }) {
  const generatedAt = new Date();
  return (
    <Document
      title={`PO ${data.number}`}
      author={data.ourCompany.name}
      subject={`Purchase Order ${data.number}`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.brandName}>{data.ourCompany.name}</Text>
            <Text style={styles.brandSub}>
              {data.ourCompany.contactEmail}  ·  {data.ourCompany.contactPhone}
            </Text>
          </View>
          <View style={styles.poNumber}>
            <Text style={styles.poNumberLabel}>Purchase order</Text>
            <Text style={styles.poNumberValue}>{data.number}</Text>
            <View style={[styles.statusPill, { backgroundColor: poStatusColor(data.status), alignSelf: 'flex-end' }]}>
              <Text>{data.status.replace(/_/g, ' ')}</Text>
            </View>
          </View>
        </View>

        {/* Meta: vendor + ship-to + dates + terms */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Vendor</Text>
            <Text style={styles.metaValue}>{data.vendor.name}</Text>
            {data.vendor.contactName ? (
              <Text style={styles.metaSub}>Attn: {data.vendor.contactName}</Text>
            ) : null}
            {data.vendor.contactEmail ? (
              <Text style={styles.metaSub}>{data.vendor.contactEmail}</Text>
            ) : null}
            {data.vendor.contactPhone ? (
              <Text style={styles.metaSub}>{data.vendor.contactPhone}</Text>
            ) : null}
            {data.vendor.addressLine1 ? (
              <Text style={styles.metaSub}>{data.vendor.addressLine1}</Text>
            ) : null}
            {data.vendor.addressLine2 ? (
              <Text style={styles.metaSub}>{data.vendor.addressLine2}</Text>
            ) : null}
            {data.vendor.city || data.vendor.state ? (
              <Text style={styles.metaSub}>
                {data.vendor.city}
                {data.vendor.city && data.vendor.state ? ', ' : ''}
                {data.vendor.state} {data.vendor.postalCode ?? ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Ship to</Text>
            <Text style={styles.metaValue}>{data.shipTo ?? '—'}</Text>
            <Text style={[styles.metaSub, { marginTop: 6 }]}>
              Needed by: {fmtDate(data.neededBy)}
            </Text>
            <Text style={styles.metaSub}>Issued: {fmtDate(data.issuedAt)}</Text>
            {data.vendorReference ? (
              <Text style={styles.metaSub}>
                Vendor ref #: {data.vendorReference}
              </Text>
            ) : null}
          </View>

          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Terms</Text>
            <Text style={styles.metaValue}>{data.terms ?? '—'}</Text>
          </View>
        </View>

        {/* Delivery block — only rendered when any delivery
            field is set. Uses an accent color so the driver's
            eye lands on it. Distinct from the "Ship to"
            column above; the driver needs the on-site point
            of contact to call when they arrive. */}
        {data.deliveryAddress || data.deliveryName || data.deliveryContactName ? (
          <View style={styles.deliveryBlock} wrap={false}>
            <Text style={styles.deliveryHeader}>DELIVERY — driver drop-off + on-site point of contact</Text>
            <View style={styles.deliveryRow}>
              <View style={styles.deliveryCol}>
                <Text style={styles.deliveryLabel}>Site / location</Text>
                <Text style={styles.deliveryValue}>{data.deliveryName ?? '—'}</Text>
              </View>
              <View style={styles.deliveryCol}>
                <Text style={styles.deliveryLabel}>Address</Text>
                <Text style={styles.deliveryValue}>{data.deliveryAddress ?? '—'}</Text>
              </View>
              <View style={styles.deliveryCol}>
                <Text style={styles.deliveryLabel}>On-site PoC</Text>
                <Text style={styles.deliveryValue}>{data.deliveryContactName ?? '—'}</Text>
                {data.deliveryContactPhone ? (
                  <Text style={styles.deliverySub}>{data.deliveryContactPhone}</Text>
                ) : null}
                {data.deliveryContactEmail ? (
                  <Text style={styles.deliverySub}>{data.deliveryContactEmail}</Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Line items */}
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, styles.cellDesc]}>Description</Text>
          <Text style={[styles.tableHeadCell, styles.cellQty]}>Qty</Text>
          <Text style={[styles.tableHeadCell, styles.cellUom]}>UoM</Text>
          <Text style={[styles.tableHeadCell, styles.cellSku]}>SKU</Text>
          <Text style={[styles.tableHeadCell, styles.cellUnit]}>Unit</Text>
          <Text style={[styles.tableHeadCell, styles.cellTotal]}>Total</Text>
        </View>
        {data.lines.map((l, i) => (
          <View
            key={i}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            wrap={false}
          >
            <View style={styles.cellDesc}>
              <Text style={styles.cellDescText}>{l.description}</Text>
              {l.isSubstitute && l.substituteNote ? (
                <Text style={styles.cellSubText}>
                  ↪ substitute: {l.substituteNote}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.cellMono, styles.cellQty]}>{l.quantity.toLocaleString()}</Text>
            <Text style={[styles.cellMono, styles.cellUom]}>{l.uom}</Text>
            <Text style={[styles.cellMono, styles.cellSku]}>{l.vendorSku ?? '—'}</Text>
            <Text style={[styles.cellMono, styles.cellUnit]}>${l.unitPrice.toFixed(4)}</Text>
            <Text style={[styles.cellMono, styles.cellTotal]}>${l.lineTotal.toFixed(2)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{fmtUsd(data.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Freight</Text>
            <Text style={styles.totalsValue}>{fmtUsd(data.freightAmount)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>{fmtUsd(data.taxAmount)}</Text>
          </View>
          <View style={styles.totalsRowGrand}>
            <Text style={styles.totalsLabelGrand}>Total</Text>
            <Text style={styles.totalsValueGrand}>{fmtUsd(data.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        ) : null}

        {/* Signature */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureCol}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>Authorized signature</Text>
            </View>
          </View>
          <View style={styles.signatureCol}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>Date</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{data.number}</Text>
          <Text>UDGOK Construction · {fmtDate(generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}
