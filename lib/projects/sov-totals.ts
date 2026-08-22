/**
 * Schedule of Values (SOV) totals — pure math.
 *
 * For a project, compute per-division billed amounts from the
 * project's pay apps, and the totals row that should always
 * equal the sum of the per-division amounts.
 *
 * The billed status set is intentional:
 *   - SENT, VIEWED, ACKNOWLEDGED, PAID, DISPUTED all count
 *   - DRAFT does NOT count (you haven't asked the client yet)
 *   - SUPERSEDED does NOT count (this draw was replaced)
 *
 * This used to be a subtle bug: the project page's TOTALS
 * row summed `payApp.totalThisDraw` filtered by status, while
 * the per-row billed amount summed all `payAppLines` regardless
 * of status. The two would disagree, so a DRAFT pay app with
 * $20k allocated to a division would show $20k in the row
 * but $0 in the TOTALS. This helper now uses ONE consistent
 * calculation that's used by both the per-row render and the
 * totals row.
 */

export const BILLED_PAY_APP_STATUSES: ReadonlySet<string> = new Set([
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
 * Filtering: only pay apps in BILLED_PAY_APP_STATUSES contribute
 * to billed totals. DRAFT and SUPERSEDED are excluded.
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
