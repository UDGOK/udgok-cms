/**
 * Procurement / RFQ module — shared types.
 *
 * Money is always Decimal(19,4). Quantities are Decimal(19,4).
 * The frontend formats these to dollars/cents with a precision
 * of 2 (money) or 4 (prices/freight) at the display layer.
 */

export type VendorCapability = 'MANUAL' | 'QUOTE_LINK' | 'PUNCHOUT' | 'API';
export type VendorStatus = 'ACTIVE' | 'INACTIVE';

export type MaterialListStatus = 'DRAFT' | 'QUOTING' | 'QUOTED' | 'CLOSED';

export type RfqStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'RESPONDED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

export type QuoteStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';

export type PoStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ISSUED'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export type PriceSource = 'MANUAL' | 'QUOTE' | 'PUNCHOUT' | 'API' | 'IMPORT';

/** Curated list of US construction UOMs (matches the
 *  spec's enum: EA, BOX, LF, SF, CY, HR, ROLL, BUNDLE, PAIL).
 *  Free-text is allowed (e.g. "TON", "GAL", "CYD") so we
 *  don't break on a vendor's preferred unit. */
export const UOMS = [
  'EA',
  'BOX',
  'LF',
  'SF',
  'CY',
  'HR',
  'ROLL',
  'BUNDLE',
  'PAIL',
] as const;
export type Uom = (typeof UOMS)[number] | string;

/** Pilot vendor seed list. When you add a real vendor for
 *  the first time, picking from this list seeds their
 *  category, default terms, and a couple of common
 *  capabilities. You can still create a vendor from
 *  scratch — this is just a shortcut. */
export const PILOT_VENDORS = [
  { name: 'Locke Supply', category: 'Plumbing & HVAC', defaultTerms: 'Net 30' },
  { name: 'Broken Arrow Electric', category: 'Electrical', defaultTerms: 'Net 30' },
  { name: 'Lowe\'s', category: 'Big-box', defaultTerms: 'Net 30' },
  { name: 'Home Depot', category: 'Big-box', defaultTerms: 'Net 30' },
] as const;

/** Server-side action result type. */
export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
