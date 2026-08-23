/**
 * Shared currency / number formatters.
 *
 * Lives in /lib/format/ (NOT /components/) because it's pure
 * and importable from both server and client components. The
 * previous setup defined these as inline functions in server
 * components, then passed them as PROPS to client components
 * — which throws "An error occurred in the Server Components
 * render" because functions are not serializable across the
 * server/client boundary. Centralizing them here so both
 * sides can `import { fmtUsd } from '@/lib/format/currency'`
 * instead.
 */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Format cents (BigInt / number) as $1,234.56 (with 2 dp). */
export function fmtUsdFromCents(cents: number | bigint): string {
  return usdCents.format(Number(cents) / 100);
}

/** Format a whole-dollar amount (number) as $1,234 (no dp). */
export function fmtUsd(amount: number): string {
  return usd.format(amount);
}

/** Format a whole-dollar amount as $1,234.56 (with 2 dp). */
export function fmtUsdPrecise(amount: number): string {
  return usdPrecise.format(amount);
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

/** Format a Date / ISO string as "Aug 19, 2026" (US-style short). */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dateFmt.format(typeof d === 'string' ? new Date(d) : d);
}

const dateInputFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Format a Date as YYYY-MM-DD (for <input type="date" value). */
export function fmtDateInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return dateInputFmt.format(date);
}
