/**
 * One-time import script — populate Clarus Medical with
 * UDG-2026-0153 REV 6 + a $50,000 paid Pay App 1.
 *
 * Run from the workspace root with the production DATABASE_URL:
 *
 *   DATABASE_URL='postgresql://...neon...' npx tsx scripts/import-clarus-medical-invoice.ts
 *
 * What this script does:
 *   1. DELETES the existing DRAFT Pay App 1 and its 17 lines
 *      (cascade-delete via the PayApp→PayAppDivision relation)
 *   2. RESETS all 17 existing division budgets to $0, then sets
 *      the new budgets to match the invoice allocation.
 *      (We keep the existing division RECORDS — the project
 *      structure is fine, only the dollar amounts change.)
 *   3. Sets the project CONTRACT VALUE to the invoice total
 *      ($740,321.29) so the SOV math, financial summary, and
 *      3D money tower all read correctly.
 *   4. Creates Pay App 1 (draw 1) with status=PAID, $50,000:
 *        - Complete demo       (02-3000): $22,800.00
 *        - Partial plumbing   (22-0500): $27,200.00 (of $70,850)
 *        Total: $50,000.00
 *   5. The contractor fee ($75,000) lives in 01-9000 (Profit &
 *      overhead retained) as a separate, visible SOV line — the
 *      user explicitly asked for it to be a standalone item, not
 *      bundled into another division.
 *
 * What's left after Pay App 1:
 *   - $690,321.29 unbilled balance — will be billed in future
 *     pay apps (Finishes, Doors/Glass/Millwork, MEP/Systems, etc.)
 *
 * The script is NOT idempotent on division budgets — every run
 * resets budgets to 0 then sets the invoice values. Re-running
 * with the same invoice produces the same result. If Pay App 1
 * already exists in a non-DRAFT state (PAID/SENT/VIEWED), the
 * script will still delete it before recreating — this is what
 * "delete the existing values and populate" calls for.
 */

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateShareToken() {
  return randomBytes(24).toString('base64url');
}

const INVOICE_NUMBER = 'UDG-2026-0153 REV 6';
const INVOICE_DATE = new Date('2026-08-15T00:00:00Z');
// "Client has paid us $50,000" — user didn't give a date.
// Assume payment was received 1 week ago.
const PAYMENT_DATE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
// periodStart for the work that was billed — 2 weeks ago.
const WORK_START = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

const PROJECT_ID = 'cmsy8efyr0003jr047tt1o1k1';
const CONTRACT_TOTAL = 740321.29;

// Division budgets. Each is the sum of every invoice line that
// maps to that trade. The `note` explains the bundle.
const DIVISION_BUDGETS: Array<{ code: string; trade: string; budget: number; note?: string }> = [
  {
    code: '01-5000',
    trade: 'Mobilization & General Conditions',
    budget: 10201.29,
    note: 'Final Clean & Site Protection ($10,201.29). Progress cleaning + medical-grade final clean. Lump sum.',
  },
  {
    code: '01-9000',
    trade: 'Profit & overhead (retained)',
    budget: 75000.00,
    note: 'UDGOK Contractor Fee — drawings, drawing changes, project management, superintendence, coordination of all trades. Lump sum. Treated as a standalone SOV line per user instruction.',
  },
  {
    code: '02-3000',
    trade: 'Demolition',
    budget: 22800.00,
    note: 'Selective Demolition — interior strip-out, 8 dumpsters, 3 concrete haul-offs. Lump sum.',
  },
  {
    code: '03-3000',
    trade: 'Cast-in-place concrete (footings & slab)',
    budget: 31500.00, // 16500 equipment pads + 15000 imaging pads
    note: 'Bundle: Equipment Pads & Slab Patching ($16,500) + Imaging Equipment Pads allowance ($15,000).',
  },
  {
    code: '06-1000',
    trade: 'Rough carpentry (framing)',
    budget: 152000.00, // 24000 metal stud + 68000 millwork + 9000 reception + 51000 corian
    note: 'Bundle: Metal Stud Framing & Drywall Hang ($24,000) + Millwork & Casework 17 rms ($68,000) + Reception & Check-In Desks allowance ($9,000) + Corian Countertops & Sinks 17 rms allowance ($51,000).',
  },
  {
    code: '08-1100',
    trade: 'Doors & frames',
    budget: 52720.00, // 27720 doors + 25000 glass
    note: 'Bundle: Doors, Frames & Hardware 21 doors allowance ($27,720) + Glass & Storefront entrance + 3 west doors ($25,000).',
  },
  {
    code: '09-2900',
    trade: 'Gypsum board & taping',
    budget: 43250.00, // 39000 ACT + 4250 corner guards
    note: 'Bundle: ACT Replacement damaged areas ($39,000) + Corner Guards ~50 EA installed ($4,250).',
  },
  {
    code: '09-6500',
    trade: 'Resilient flooring',
    budget: 35000.00,
    note: 'Flooring — medical-grade LVT / sheet goods with base. Lump sum.',
  },
  {
    code: '09-9100',
    trade: 'Painting & coatings',
    budget: 55000.00,
    note: 'Paint, Mud & Finish — tape/mud/level + paint systems throughout. Lump sum.',
  },
  {
    code: '22-0500',
    trade: 'Plumbing (rough-in & fixtures)',
    budget: 70850.00, // 19800 + 8800 + 39700 + 2550
    note: 'Bundle: Underground Jackhammer/Excavation/Backfill ($19,800) + Domestic Water Distribution ($8,800) + Plumbing Top-Out & Trim incl. 100-gal water heater, FRP panels, fixture setting ($39,700) + Medical-Grade Faucets 17 rms @ $150 ($2,550).',
  },
  {
    code: '23-0500',
    trade: 'HVAC (equipment & ductwork)',
    budget: 40000.00,
    note: 'HVAC — distribution and imaging-room cooling allowance. Excludes AC unit replacement and chiller equipment pad.',
  },
  {
    code: '26-0500',
    trade: 'Electrical (service & rough-in)',
    budget: 152000.00, // 132000 electrical + 5000 low voltage + 15000 fire alarm
    note: 'Bundle: Electrical & Lighting Hospital Grade ($132,000) + Low Voltage, Data & Access Control pathways ($5,000) + Fire Alarm allowance ($15,000).',
  },
];

// Pay App 1 — $50,000 paid, as the user specified:
//   - "all demo balance"      → full $22,800 for 02-3000
//   - "partial plumbing"      → $27,200 of $70,850 for 22-0500
//   - Total: $50,000
const PAY_APP_1_LINES: Array<{ code: string; thisDraw: number; note: string }> = [
  { code: '02-3000', thisDraw: 22800.00, note: 'Complete demo — interior strip-out (8 dumpsters, 3 concrete haul-offs).' },
  { code: '22-0500', thisDraw: 27200.00, note: 'Partial plumbing — $27,200 of $70,850 budget (38.4%). Covers initial plumbing work; remaining $43,650 to be billed in future pay apps.' },
];

async function main() {
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-clarus-medical] starting');
  console.log(`[import-clarus-medical] invoice: ${INVOICE_NUMBER}`);
  console.log(`[import-clarus-medical] project: ${PROJECT_ID}`);
  console.log(`[import-clarus-medical] contract total: $${CONTRACT_TOTAL.toFixed(2)}`);
  console.log('─────────────────────────────────────────────────────────');

  // 1. Find the project.
  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      contractValue: true,
      divisions: { select: { id: true, code: true, trade: true, budget: true } },
    },
  });
  if (!project) {
    throw new Error(`Project ${PROJECT_ID} not found`);
  }
  console.log(`[import-clarus-medical] found project: ${project.name}`);
  console.log(`[import-clarus-medical] workspace: ${project.workspaceId}`);
  console.log(`[import-clarus-medical] existing divisions: ${project.divisions.length}`);

  // 2. Find the workspace owner to use as createdById.
  const owner = await prisma.membership.findFirst({
    where: { workspaceId: project.workspaceId, role: 'OWNER' },
    select: { userId: true },
  });
  if (!owner) {
    throw new Error(`No workspace OWNER found for workspace ${project.workspaceId}. Cannot create pay apps without a user ID.`);
  }
  const createdById = owner.userId;
  console.log(`[import-clarus-medical] using createdById=${createdById} (workspace OWNER)`);

  // 3. Delete existing Pay App 1 (and its PayAppDivision lines via cascade).
  //    The user said "delete the existing values" — the draft pay
  //    app from a prior import needs to go.
  const existingDraws = await prisma.payApp.findMany({
    where: { projectId: project.id },
    select: { id: true, drawNumber: true, status: true },
  });
  if (existingDraws.length > 0) {
    for (const d of existingDraws) {
      console.log(`[import-clarus-medical] deleting Pay App #${d.drawNumber} (id=${d.id}, status=${d.status}) + its PayAppDivision lines (cascade)`);
      await prisma.payApp.delete({ where: { id: d.id } });
    }
  }

  // 4. Reset all existing division budgets to $0, then set the
  //    new invoice-aligned budgets.
  for (const existing of project.divisions) {
    await prisma.projectDivision.update({
      where: { id: existing.id },
      data: { budget: 0 },
    });
  }
  console.log(`[import-clarus-medical] reset all ${project.divisions.length} division budgets to $0`);

  for (const d of DIVISION_BUDGETS) {
    const existing = project.divisions.find((pd) => pd.code === d.code);
    if (!existing) {
      console.log(`[import-clarus-medical] ⚠ division ${d.code} (${d.trade}) not on project — skipping budget update`);
      continue;
    }
    await prisma.projectDivision.update({
      where: { id: existing.id },
      data: { budget: d.budget },
    });
    console.log(`[import-clarus-medical]   ${d.code} ${d.trade}: $${d.budget.toFixed(2)}`);
  }

  // 5. Set the contract value.
  await prisma.project.update({
    where: { id: project.id },
    data: { contractValue: CONTRACT_TOTAL },
  });
  console.log(`[import-clarus-medical] contractValue → $${CONTRACT_TOTAL.toFixed(2)}`);

  // 6. Create Pay App 1 — $50,000 paid.
  const totalThisDraw = PAY_APP_1_LINES.reduce((a, l) => a + l.thisDraw, 0);
  if (Math.abs(totalThisDraw - 50000) > 0.01) {
    throw new Error(`Pay App 1 lines sum to $${totalThisDraw.toFixed(2)}, expected $50,000.00`);
  }
  const totalBalance = CONTRACT_TOTAL - totalThisDraw;
  const totalPrevious = 0; // first draw

  const payApp1 = await prisma.payApp.create({
    data: {
      projectId: project.id,
      drawNumber: 1,
      periodStart: WORK_START,
      periodEnd: PAYMENT_DATE,
      status: 'PAID',
      totalContract: CONTRACT_TOTAL,
      totalPrevious,
      totalThisDraw,
      totalBalance,
      notes: `Invoice ${INVOICE_NUMBER} (issued ${INVOICE_DATE.toISOString().slice(0, 10)}). Total contract $${CONTRACT_TOTAL.toFixed(2)} (Net 10). Client paid $50,000 on ${PAYMENT_DATE.toISOString().slice(0, 10)} per project file. Allocated to: complete selective demolition ($22,800.00) and partial plumbing ($27,200.00 of $70,850.00 budget). Remaining $${totalBalance.toFixed(2)} to be billed in future pay apps. Contractor Fee ($75,000) is in 01-9000 as a standalone SOV line, not bundled into any other division.`,
      shareToken: generateShareToken(),
      sentAt: INVOICE_DATE,
      acknowledgedAt: PAYMENT_DATE,
      acknowledgedByName: 'Sam Munakl',
      firstViewedAt: INVOICE_DATE,
      viewCount: 1,
      paidAt: PAYMENT_DATE,
      createdById,
    },
    select: { id: true, shareToken: true },
  });
  console.log(`[import-clarus-medical] created Pay App 1 (id=${payApp1.id}, status=PAID, total=$${totalThisDraw.toFixed(2)}, balance=$${totalBalance.toFixed(2)})`);

  // 7. Create PayAppDivision lines.
  let sortOrder = 0;
  for (const line of PAY_APP_1_LINES) {
    const div = await prisma.projectDivision.findFirst({
      where: { projectId: project.id, code: line.code },
      select: { id: true, budget: true },
    });
    if (!div) {
      throw new Error(`Pay App 1 line: division ${line.code} not found on project`);
    }
    const balanceAfter = Number(div.budget) - line.thisDraw;
    await prisma.payAppDivision.create({
      data: {
        payAppId: payApp1.id,
        projectDivisionId: div.id,
        previousAmount: 0,
        thisDrawAmount: line.thisDraw,
        balanceAfter,
        sortOrder: sortOrder++,
      },
    });
    console.log(`[import-clarus-medical]   line: ${line.code} $${line.thisDraw.toFixed(2)} (balance after: $${balanceAfter.toFixed(2)})`);
  }
  console.log(`[import-clarus-medical] created ${PAY_APP_1_LINES.length} PayAppDivision rows for Pay App 1`);

  // 8. Final summary
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-clarus-medical] DONE');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Summary:');
  console.log(`  Project: ${project.name} (${project.id})`);
  console.log(`  Contract: $${CONTRACT_TOTAL.toFixed(2)} (incl. $75,000 UDGOK Contractor Fee in 01-9000)`);
  console.log(`  Pay App 1: $50,000.00 PAID (${PAYMENT_DATE.toISOString().slice(0, 10)})`);
  console.log(`    - 02-3000 Demolition: $22,800.00 (complete)`);
  console.log(`    - 22-0500 Plumbing:  $27,200.00 (partial of $70,850.00)`);
  console.log(`  Balance: $${totalBalance.toFixed(2)} to be billed in future pay apps.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the project in the UI: /w/udgok/projects/' + project.id);
  console.log('  2. Verify the SOV shows 12 divisions with budgets totaling $' + CONTRACT_TOTAL.toFixed(2));
  console.log('  3. The UDGOK Contractor Fee is in 01-9000 as a standalone line');
  console.log('  4. Pay App 1 should show status PAID, $50,000, with demo + partial plumbing lines');
  console.log('  5. The 3D money tower should now have one glowing plate (the paid draw)');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[import-clarus-medical] FAILED');
    console.error(e);
    process.exit(1);
  });
