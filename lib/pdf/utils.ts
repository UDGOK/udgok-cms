/**
 * Formatters and small helpers for the Project Book PDF.
 *
 * Currency uses en-US / no fractional cents (we're a construction
 * CMS, not a bank — $854,000 not $854,000.00). Dates are en-US
 * short form ("Mar 14, 2026") for readability in print.
 *
 * Status enums are normalized to human labels so the PDF never
 * shows raw enum values like "ROUGH_IN" or "ACKNOWLEDGED".
 */

import { colors } from './styles';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const compactUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  notation: 'compact',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "$854,000" — never "$854,000.00" because we're not a bank. */
export function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return usdFormatter.format(value);
}

/** "$854k" — compact form for headers and pills. */
export function fmtUsdCompact(value: number | null | undefined): string {
  if (value == null) return '—';
  return compactUsdFormatter.format(value);
}

/** "Mar 14, 2026" */
export function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFormatter.format(d);
}

/** "Aug 19, 14:32" — used in activity log. */
export function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateTimeFormatter.format(d);
}

/** "36.0526, -95.9464" — concise GPS for the photo tile caption. */
export function fmtCoord(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Initials for the team-card avatar (e.g. "Yasir K." → "YK"). */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Project status → pill background color. Mirrors the in-app
 * color so the PDF matches what the user sees on the web.
 */
export function projectStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return colors.success;
    case 'ON_HOLD': return colors.warning;
    case 'COMPLETED': return colors.ink;
    case 'CANCELLED': return colors.line;
    default: return colors.paper2;
  }
}

/**
 * Subcontractor status → pill background color.
 */
export function subStatusColor(status: string): string {
  switch (status) {
    case 'PROPOSED': return colors.paper2;
    case 'CONTRACTED': return colors.warning;
    case 'ACTIVE': return colors.success;
    case 'COMPLETED': return colors.ink;
    case 'CANCELLED': return colors.line;
    default: return colors.paper2;
  }
}

/**
 * Pay-app status → pill background color.
 */
export function payAppStatusColor(status: string): string {
  switch (status) {
    case 'DRAFT': return colors.paper2;
    case 'SENT': return colors.ink;
    case 'VIEWED': return colors.info;
    case 'ACKNOWLEDGED': return colors.orange;
    case 'PAID': return colors.success;
    case 'DISPUTED': return colors.error;
    case 'SUPERSEDED': return colors.line;
    default: return colors.paper2;
  }
}

/**
 * Pay-app status → human label.
 */
export function payAppStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT': return 'Draft';
    case 'SENT': return 'Sent';
    case 'VIEWED': return 'Viewed';
    case 'ACKNOWLEDGED': return 'Acknowledged';
    case 'PAID': return 'Paid';
    case 'DISPUTED': return 'Disputed';
    case 'SUPERSEDED': return 'Superseded';
    default: return status;
  }
}

/**
 * Task status → human label and color. We use a single shape
 * (label + color) so the table doesn't need a separate switch.
 */
export function taskStatusInfo(status: string): { label: string; color: string } {
  switch (status) {
    case 'TODO': return { label: 'To do', color: colors.ink50 };
    case 'IN_PROGRESS': return { label: 'In progress', color: colors.orange };
    case 'BLOCKED': return { label: 'Blocked', color: colors.error };
    case 'DONE': return { label: 'Done', color: colors.success };
    case 'CANCELLED': return { label: 'Cancelled', color: colors.line };
    default: return { label: status, color: colors.ink50 };
  }
}

/**
 * Subcontractor status → human label.
 */
export function subStatusLabel(status: string): string {
  switch (status) {
    case 'PROPOSED': return 'Proposed';
    case 'CONTRACTED': return 'Contracted';
    case 'ACTIVE': return 'Active';
    case 'COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    default: return status;
  }
}

/**
 * Permit status → label + color. Permits use bespoke status
 * strings (e.g. "Rough-in pending") so we map common ones.
 */
export function permitStatusInfo(status: string): { label: string; color: string } {
  const s = status.toLowerCase();
  if (s.includes('final') || s === 'completed' || s === 'passed') {
    return { label: 'Final', color: colors.success };
  }
  if (s.includes('rough') && s.includes('pending')) {
    return { label: 'Rough-in pending', color: colors.warning };
  }
  if (s.includes('issued') || s === 'approved') {
    return { label: 'Issued', color: colors.orange };
  }
  if (s.includes('review') || s === 'submitted' || s === 'pending') {
    return { label: 'In review', color: colors.info };
  }
  if (s === 'expired' || s === 'denied') {
    return { label: status, color: colors.error };
  }
  return { label: status, color: colors.ink50 };
}

/**
 * Safely convert a Prisma Decimal-like (or number) to a number.
 * Most of our numeric fields come back as Decimal from Postgres;
 * we treat anything with a toString() method the same way.
 */
export function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const n = Number((value as { toString(): string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** "PROJECT", or the project code if set, in monospace style. */
export function projectCode(code: string | null | undefined, fallbackId: string): string {
  if (code) return code;
  return fallbackId.slice(0, 6).toUpperCase();
}
