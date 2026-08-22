/**
 * Tests for the Schedule of Values (SOV) totals math.
 *
 * The bug these tests guard against: the TOTALS row in the
 * project page used to disagree with the per-row "Billed"
 * column. A DRAFT pay app with $20k allocated to a division
 * would show $20k in the row but $0 in the TOTALS. After the
 * refactor, the same math is used for both — these tests
 * pin that down.
 */

import { describe, it, expect } from 'vitest';
import {
  BILLED_PAY_APP_STATUSES,
  computeBilledByDivision,
  computeTotalBudget,
  computeTotalBilled,
  computeRemaining,
} from '../sov-totals';

const D = (id: string, budget: number | string = 0) => ({ id, budget });
const PA = (
  status: string,
  lines: { projectDivisionId: string; thisDrawAmount: number | string }[],
) => ({ status, divisions: lines });

describe('BILLED_PAY_APP_STATUSES', () => {
  it('includes the right statuses', () => {
    expect(BILLED_PAY_APP_STATUSES.has('SENT')).toBe(true);
    expect(BILLED_PAY_APP_STATUSES.has('VIEWED')).toBe(true);
    expect(BILLED_PAY_APP_STATUSES.has('ACKNOWLEDGED')).toBe(true);
    expect(BILLED_PAY_APP_STATUSES.has('PAID')).toBe(true);
    expect(BILLED_PAY_APP_STATUSES.has('DISPUTED')).toBe(true);
  });
  it('excludes draft and superseded', () => {
    expect(BILLED_PAY_APP_STATUSES.has('DRAFT')).toBe(false);
    expect(BILLED_PAY_APP_STATUSES.has('SUPERSEDED')).toBe(false);
  });
});

describe('computeBilledByDivision', () => {
  it('returns zero for every division when there are no pay apps', () => {
    const out = computeBilledByDivision([D('d1', 100), D('d2', 200)], []);
    expect(out).toEqual({ d1: 0, d2: 0 });
  });

  it('ignores DRAFT pay apps (this was the bug)', () => {
    // The previous version summed DRAFT pay apps into per-row
    // but excluded them from TOTALS, so a $20k DRAFT allocation
    // would show $20k in the row but $0 in TOTALS. Now we
    // consistently exclude DRAFT from both.
    const out = computeBilledByDivision(
      [D('d1', 25000)],
      [PA('DRAFT', [{ projectDivisionId: 'd1', thisDrawAmount: 20000 }])],
    );
    expect(out.d1).toBe(0);
  });

  it('counts SENT pay apps', () => {
    const out = computeBilledByDivision(
      [D('d1', 25000)],
      [PA('SENT', [{ projectDivisionId: 'd1', thisDrawAmount: 20000 }])],
    );
    expect(out.d1).toBe(20000);
  });

  it('counts PAID pay apps', () => {
    const out = computeBilledByDivision(
      [D('d1', 25000)],
      [PA('PAID', [{ projectDivisionId: 'd1', thisDrawAmount: 25000 }])],
    );
    expect(out.d1).toBe(25000);
  });

  it('ignores SUPERSEDED pay apps', () => {
    const out = computeBilledByDivision(
      [D('d1', 25000)],
      [PA('SUPERSEDED', [{ projectDivisionId: 'd1', thisDrawAmount: 25000 }])],
    );
    expect(out.d1).toBe(0);
  });

  it('sums lines from multiple pay apps on the same division', () => {
    const out = computeBilledByDivision(
      [D('d1', 25000)],
      [
        PA('PAID', [{ projectDivisionId: 'd1', thisDrawAmount: 10000 }]),
        PA('SENT', [{ projectDivisionId: 'd1', thisDrawAmount: 5000 }]),
      ],
    );
    expect(out.d1).toBe(15000);
  });

  it('handles the user-reported scenario: 1 DRAFT + 1 SENT on same division', () => {
    // From the bug report: "Wire Run Labor" has budget $25k,
    // billed $20k, remaining $5k. The TOTALS row was $0 because
    // it only counted PAID/SENT etc but the row summed DRAFT
    // too. With the fix, both should agree.
    const out = computeBilledByDivision(
      [D('d1', 25000)],
      [
        PA('DRAFT', [{ projectDivisionId: 'd1', thisDrawAmount: 0 }]),
        PA('SENT', [{ projectDivisionId: 'd1', thisDrawAmount: 20000 }]),
      ],
    );
    expect(out.d1).toBe(20000);
  });

  it('skips lines referencing deleted divisions', () => {
    const out = computeBilledByDivision(
      [D('d1', 100)],
      [PA('SENT', [
        { projectDivisionId: 'd1', thisDrawAmount: 50 },
        { projectDivisionId: 'd_deleted', thisDrawAmount: 999 },
      ])],
    );
    expect(out.d1).toBe(50);
    expect(out.d_deleted).toBeUndefined();
  });

  it('handles Prisma Decimal values (string-coercible)', () => {
    const decimalLike = { toString: () => '1234.56' };
    const out = computeBilledByDivision(
      [D('d1', 5000)],
      [PA('SENT', [{ projectDivisionId: 'd1', thisDrawAmount: decimalLike }])],
    );
    expect(out.d1).toBe(1234.56);
  });
});

describe('computeTotalBudget', () => {
  it('sums all division budgets', () => {
    expect(computeTotalBudget([D('d1', 100), D('d2', 200), D('d3', 50)])).toBe(350);
  });
  it('handles empty input', () => {
    expect(computeTotalBudget([])).toBe(0);
  });
  it('handles Prisma Decimal string-coercible values', () => {
    expect(computeTotalBudget([D('d1', { toString: () => '1000.50' } as never)])).toBe(1000.5);
  });
});

describe('computeTotalBilled', () => {
  it('sums all division billed amounts', () => {
    expect(computeTotalBilled({ d1: 100, d2: 200, d3: 50 })).toBe(350);
  });
  it('handles empty map', () => {
    expect(computeTotalBilled({})).toBe(0);
  });
});

describe('computeRemaining', () => {
  it('returns contract - billed', () => {
    expect(computeRemaining(58150, 20000)).toBe(38150);
  });
  it('does not go negative (extra billed above contract = 0 remaining)', () => {
    expect(computeRemaining(1000, 1500)).toBe(0);
  });
});

describe('SOV consistency — the original bug', () => {
  /**
   * The bug: TOTALS row used `payApp.status` filter on the
   * parent pay app and summed `totalThisDraw`, while the
   * per-row billed amount summed all `payAppLines` regardless
   * of status. They disagreed, so the user's screenshot
   * showed "$20,000 billed" on the row but "$0" in TOTALS.
   *
   * With the fix, both the per-row billed (billedByDivision[id])
   * and the TOTALS row (sum of billedByDivision values) come
   * from the same function. These tests pin that down so the
   * bug doesn't come back.
   *
   * Mirrors the exact scenario from the bug report: budget
   * $58,150 across 6 divisions, $20,000 billed on one
   * division, expected remaining $38,150.
   */
  it('per-row billed equals TOTALS billed (matches by construction)', () => {
    const divisions = [
      D('d1', 25000), // Wire Run Labor
      D('d2', 7500),
      D('d3', 16800),
      D('d4', 5000),
      D('d5', 3500),
      D('d6', 350),
    ];
    // SENT pay app: $20k on Wire Run Labor (d1), nothing on others.
    const payApps = [
      PA('SENT', [{ projectDivisionId: 'd1', thisDrawAmount: 20000 }]),
    ];
    const billedByDivision = computeBilledByDivision(divisions, payApps);
    const totalBudget = computeTotalBudget(divisions);
    const totalBilled = computeTotalBilled(billedByDivision);
    const remaining = computeRemaining(totalBudget, totalBilled);

    // Per-row: d1=20000, others=0
    expect(billedByDivision.d1).toBe(20000);
    expect(billedByDivision.d2).toBe(0);
    // TOTALS: 20000 (single source of truth)
    expect(totalBilled).toBe(20000);
    // Budget: 58150
    expect(totalBudget).toBe(58150);
    // Remaining: 58150 - 20000 = 38150 (this is the user's expected value)
    expect(remaining).toBe(38150);
  });

  it('DRAFT pay apps do not contribute to TOTALS (correct semantics)', () => {
    // A draft hasn't been sent to the client. It shouldn't
    // count as "billed" — that money hasn't been requested.
    const out = computeBilledByDivision(
      [D('d1', 1000)],
      [PA('DRAFT', [{ projectDivisionId: 'd1', thisDrawAmount: 1000 }])],
    );
    expect(out.d1).toBe(0);
    expect(computeTotalBilled(out)).toBe(0);
  });
});
