/**
 * Schedule of Values (SOV) totals — pure math.
 *
 * For a project, compute per-division billed amounts from the
 * project's pay apps, and the totals row that should always
 * equal the sum of the per-division amounts.
 *
 * "Billed" in construction means: money allocated to a
 * division via a pay-app line — regardless of whether that
 * pay app has been sent to the client. A DRAFT pay app counts
 * because the work has been allocated to the line item;
 * it's just not yet "submitted" to the client for payment.
 * SUPERSEDED does NOT count because the draw was replaced.
 *
 * This used to be a subtle bug: the project page's TOTALS
 * row summed `payApp.totalThisDraw` filtered by status, while
 * the per-row billed amount summed all `payAppLines` regardless
 * of status. The two would disagree, so a DRAFT pay app with
 * $20k allocated to a division would show $20k in the row
 * but $0 in TOTALS. This helper now uses ONE consistent
 * calculation that's used by both the per-row render and the
 * totals row.
 */

export const BILLED_PAY_APP_STATUSES: ReadonlySet<string> = new Set([
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACKNOWLEDGED',
  'PAID',
  'DISPUTED',
]);

// Minimal shapes — accept anything with these fields. Using
// `unknown` for numeric fields so Prisma's `Decimal` (which has
// a toString method but is neither number nor string at the
// type level) is compatible. The `num()` helper below handles
// the runtime coercion.
export type SovPayAppLine = {
  projectDivisionId: string;
  thisDrawAmount: unknown;
};
export type SovPayApp = {
  status: string;
  divisions: SovPayAppLine[];
};
export type SovDivision = {
  id: string;
  budget: unknown;
};

/**
 * Per-division billed amount (a map of divisionId → dollars).
 * TOTALS row is just the sum of all values in this map.
 *
 * Filtering: pay apps in BILLED_PAY_APP_STATUSES contribute
 * to billed totals. SUPERSEDED is excluded (replaced by a
 * newer draw). DRAFT counts because the work is allocated
 * to the line item, even before submission to the client.
 */
export function computeBilledByDivision(
  divisions: SovDivision[],
  payApps: SovPayApp[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of divisions) out[d.id] = 0;
  for (const p of payApps) {
    if (!BILLED_PAY_APP_STATUSES.has(p.status)) continue;
    for (const line of p.divisions) {
      const id = line.projectDivisionId;
      if (!(id in out)) continue; // division deleted but line still references it
      out[id] = (out[id] ?? 0) + num(line.thisDrawAmount);
    }
  }
  return out;
}

/** Sum of all division budgets. */
export function computeTotalBudget(divisions: SovDivision[]): number {
  return divisions.reduce((acc, d) => acc + num(d.budget), 0);
}

/** Sum of all billed amounts. */
export function computeTotalBilled(billedByDivision: Record<string, number>): number {
  return Object.values(billedByDivision).reduce((acc, n) => acc + n, 0);
}

/** contract - billed, never negative. */
export function computeRemaining(contractValue: number, billed: number): number {
  return Math.max(0, contractValue - billed);
}

function num(x: unknown): number {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  if (typeof (x as { toString?: () => string }).toString === 'function') {
    const n = Number((x as { toString: () => string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
