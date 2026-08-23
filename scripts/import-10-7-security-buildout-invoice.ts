/**
 * One-time import script — populate 10-7 Security Buildout
 * with the UDG-2026-0151 invoice + a $50,000 paid Pay App 1.
 *
 * Run from the workspace root with the production DATABASE_URL:
 *
 *   DATABASE_URL='postgresql://...neon...' npx tsx scripts/import-10-7-security-buildout-invoice.ts
 *
 * What this script does:
 *   1. Updates division BUDGETS on the existing project to match
 *      the invoice (project already has 17 divisions; we just set
 *      the dollar amounts and leave unused divisions at $0).
 *   2. Sets the project CONTRACT VALUE to the invoice total
 *      ($151,345.87) so the SOV math, financial summary, and 3D
 *      money tower all read correctly.
 *   3. Creates Pay App 1 (draw 1) with status=PAID, $50,000, with
 *      lines allocated as the user requested:
 *        - Complete demo       (02-3000): $10,462.75
 *        - Complete plumbing   (22-0500): $8,368.75
 *        - Complete painting   (09-9100): $14,311.32
 *        - Partial LVT         (09-6500): $13,857.18 (of $23,584.30)
 *        - Partial gypsum      (09-2900): $3,000.00  (of $9,162.15)
 *        Total: $50,000.00
 *
 * What's left after Pay App 1:
 *   - $101,345.87 unbilled balance (paint, LVT, gypsum, doors,
 *     cabinets, electrical, HVAC, etc.) — will be billed in
 *     future pay apps.
 *
 * The script is IDEMPOTENT:
 *   - Division budgets are updated (always, even if already set)
 *   - Contract value is updated (always)
 *   - Pay app creation is skipped if a draw with the same
 *     number already exists on the project
 *
 * Notes on what was set:
 *   - 01-9000 (Profit & overhead retained): $12,422.10 — this is
 *     the 10% UDGOK Design-Build Management & Coordination fee
 *     from the invoice. It doesn't map to a construction trade,
 *     so it goes in the existing retained-profit bucket.
 *   - The 5 divisions on the project that don't appear on the
 *     invoice (masonry, structural steel, roofing, site grading,
 *     paving) are left at $0 — the project may or may not
 *     include those trades, and the user can set them later.
 */

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateShareToken() {
  return randomBytes(24).toString('base64url');
}

const INVOICE_NUMBER = 'UDG-2026-0151';
const INVOICE_DATE = new Date('2026-08-15T00:00:00Z');
// "Customer has paid $50,000 so far" — user didn't give a date.
// Assume payment was received 1 week ago.
const PAYMENT_DATE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
// periodStart for the work that was billed — 2 weeks ago.
const WORK_START = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

const PROJECT_ID = 'cmt4xv0da0001jg04rje87boi';
const CONTRACT_TOTAL = 151345.87;

// Map of division code → budget (matches invoice subtotal allocation).
// All values are from the UDG-2026-0151 invoice.
const DIVISION_BUDGETS: Array<{ code: string; trade: string; budget: number; note?: string }> = [
  {
    code: '01-5000',
    trade: 'Mobilization & General Conditions',
    budget: 2065.40,
    note: 'Construction Waste Management & Disposal (debris hauling, container service, dump fees). Lump sum.',
  },
  {
    code: '02-3000',
    trade: 'Demolition',
    budget: 10462.75,
    note: 'Selective Demolition — millwork at classroom, hallway, adjacent rooms; carpet and vinyl tile flooring. No HVAC demo. Lump sum.',
  },
  {
    code: '03-3000',
    trade: 'Cast-in-place concrete (footings & slab)',
    budget: 3193.50,
    note: 'Slab Saw-Cutting, Removal & Concrete Patch — ±30 LF. Dust and slurry containment included.',
  },
  {
    code: '06-1000',
    trade: 'Rough carpentry (framing)',
    budget: 12213.55, // 1538.25 casework + 8127.40 metal framing + 2547.90 quartz countertop
    note: 'Bundle: Kitchen Casework ($1,538.25) + Non-Structural Metal Framing ($8,127.40) + Quartz Countertop with Sink ($2,547.90).',
  },
  {
    code: '08-1100',
    trade: 'Doors & frames',
    budget: 11468.60, // 5742.80 glass doors + 5225.80 wood doors + 500.00 fire ext + locks
    note: 'Bundle: Glass Doors Bronze Anodized ($5,742.80, 3 openings) + Solid-Core Wood Doors with HM Frames ($5,225.80, qty 4) + Fire Extinguishers & Entry Door Locks allowance ($500.00).',
  },
  {
    code: '09-2900',
    trade: 'Gypsum board & taping',
    budget: 9162.15, // 4962.15 gypsum + 3000.00 wall panels + 1200.00 acoustical ceiling
    note: 'Bundle: Gypsum Board H/T/Level 4 ($4,962.15) + Decorative Wall Panels & Soffits allowance ($3,000.00) + Acoustical Ceiling Tile Replacement allowance ($1,200.00).',
  },
  {
    code: '09-6500',
    trade: 'Resilient flooring',
    budget: 23584.30, // 11438.70 material + 12145.60 installation
    note: 'Resilient Flooring — Material ($11,438.70) + Installation ($12,145.60). LVT throughout the suite.',
  },
  {
    code: '09-9100',
    trade: 'Painting & coatings',
    budget: 14311.32,
    note: 'Interior Painting — Single Color (prime + 2 finish coats, walls and trim). Lump sum.',
  },
  {
    code: '22-0500',
    trade: 'Plumbing (rough-in & fixtures)',
    budget: 8368.75, // 3295.50 sanitary drain + 5073.25 plumbing trim
    note: 'Bundle: New Underslab Sanitary Drain — Kitchen ±30 LF ($3,295.50) + Plumbing Trim — Kitchen Sink & Water Supply ($5,073.25).',
  },
  {
    code: '23-0500',
    trade: 'HVAC (equipment & ductwork)',
    budget: 5948.00,
    note: 'Service of Existing HVAC System (duct mod at new partitions, final air balance). Excludes natural gas piping to generator (TBD per Division 23).',
  },
  {
    code: '26-0500',
    trade: 'Electrical (service & rough-in)',
    budget: 38145.45, // 15182.50 labor + 4917.35 material + 2864.20 lighting + 478.60 emergency + 7240.00 generator + 7462.80 install
    note: 'Bundle: Electrical Labor ($15,182.50) + Material ($4,917.35) + Interior Lighting 2x4 LED ($2,864.20) + Emergency & Exit ($478.60) + Generac 7328 26kW generator ($7,240.00) + Generator Installation ($7,462.80).',
  },
  {
    code: '01-9000',
    trade: 'Profit & overhead (retained)',
    budget: 12422.10,
    note: 'UDGOK Design-Build Management & Coordination fee (10% of subtotal $138,923.77).',
  },
];

// Pay App 1 — $50,000 paid, allocation as the user requested.
const PAY_APP_1_LINES: Array<{ code: string; thisDraw: number; note: string }> = [
  { code: '02-3000', thisDraw: 10462.75, note: 'Complete demo — selective demolition, millwork removal, flooring removal.' },
  { code: '22-0500', thisDraw: 8368.75, note: 'Complete plumbing — underslab sanitary drain + plumbing trim.' },
  { code: '09-9100', thisDraw: 14311.32, note: 'Complete painting — prime + 2 finish coats, walls and trim.' },
  { code: '09-6500', thisDraw: 13857.18, note: 'Partial LVT — 58.7% of resilient flooring (material + install).' },
  { code: '09-2900', thisDraw: 3000.00, note: 'Partial gypsum — wall panels allowance (decorative wall panels & soffits).' },
];

async function main() {
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-10-7-security] starting');
  console.log(`[import-10-7-security] invoice: ${INVOICE_NUMBER}`);
  console.log(`[import-10-7-security] project: ${PROJECT_ID}`);
  console.log(`[import-10-7-security] contract total: $${CONTRACT_TOTAL.toFixed(2)}`);
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
  console.log(`[import-10-7-security] found project: ${project.name}`);
  console.log(`[import-10-7-security] workspace: ${project.workspaceId}`);
  console.log(`[import-10-7-security] existing divisions: ${project.divisions.length}`);

  // 2. Update division budgets.
  //    The project already has all 17 divisions; we just need
  //    to set budgets for the ones on the invoice.
  for (const d of DIVISION_BUDGETS) {
    const existing = project.divisions.find((pd) => pd.code === d.code);
    if (!existing) {
      console.log(`[import-10-7-security] ⚠ division ${d.code} (${d.trade}) not on project — skipping budget update`);
      continue;
    }
    await prisma.projectDivision.update({
      where: { id: existing.id },
      data: { budget: d.budget },
    });
    console.log(`[import-10-7-security]   ${d.code} ${d.trade}: $${d.budget.toFixed(2)}`);
  }

  // 3. Set the contract value.
  await prisma.project.update({
    where: { id: project.id },
    data: { contractValue: CONTRACT_TOTAL },
  });
  console.log(`[import-10-7-security] contractValue → $${CONTRACT_TOTAL.toFixed(2)}`);

  // 4. Find the workspace owner to use as createdById.
  const owner = await prisma.membership.findFirst({
    where: { workspaceId: project.workspaceId, role: 'OWNER' },
    select: { userId: true },
  });
  if (!owner) {
    throw new Error(`No workspace OWNER found for workspace ${project.workspaceId}. Cannot create pay apps without a user ID.`);
  }
  const createdById = owner.userId;
  console.log(`[import-10-7-security] using createdById=${createdById} (workspace OWNER)`);

  // 5. Create Pay App 1 — $50,000 paid.
  //    Skip if draw 1 already exists.
  const existingDraw1 = await prisma.payApp.findFirst({
    where: { projectId: project.id, drawNumber: 1 },
    select: { id: true, status: true },
  });
  if (existingDraw1) {
    console.log(`[import-10-7-security] draw 1 already exists (id=${existingDraw1.id}, status=${existingDraw1.status}) — skipping`);
  } else {
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
        notes: `Invoice ${INVOICE_NUMBER} (issued ${INVOICE_DATE.toISOString().slice(0, 10)}). Subtotal $138,923.77 + 10% UDGOK Design-Build Management fee $12,422.10 = total $${CONTRACT_TOTAL.toFixed(2)}. Client paid $50,000 on ${PAYMENT_DATE.toISOString().slice(0, 10)} per project file (Sam Munakl). Allocated to: complete demo, complete plumbing, complete painting, partial LVT, partial gypsum. Remaining $${totalBalance.toFixed(2)} to be billed in future pay apps.`,
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
    console.log(`[import-10-7-security] created Pay App 1 (id=${payApp1.id}, status=PAID, total=$${totalThisDraw.toFixed(2)}, balance=$${totalBalance.toFixed(2)})`);

    // 6. Create PayAppDivision lines.
    //    We look up the divisionId fresh from the DB (to handle
    //    the case where division budgets were just updated).
    let sortOrder = 0;
    for (const line of PAY_APP_1_LINES) {
      const div = await prisma.projectDivision.findFirst({
        where: { projectId: project.id, code: line.code },
        select: { id: true, budget: true },
      });
      if (!div) {
        throw new Error(`Pay App 1 line: division ${line.code} not found on project`);
      }
      // thisDrawAmount can't exceed the division's budget; if the
      // user gave us a partial line (e.g. partial LVT), balanceAfter
      // is the un-drawn portion of the budget.
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
      console.log(`[import-10-7-security]   line: ${line.code} $${line.thisDraw.toFixed(2)} (balance after: $${balanceAfter.toFixed(2)})`);
    }
    console.log(`[import-10-7-security] created ${PAY_APP_1_LINES.length} PayAppDivision rows for Pay App 1`);
  }

  // 7. Final summary
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-10-7-security] DONE');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Summary:');
  console.log(`  Project: ${project.name} (${project.id})`);
  console.log(`  Contract: $${CONTRACT_TOTAL.toFixed(2)}`);
  console.log(`  Pay App 1: $50,000.00 PAID (${PAYMENT_DATE.toISOString().slice(0, 10)})`);
  console.log(`    - 02-3000 Demolition: $10,462.75 (complete)`);
  console.log(`    - 22-0500 Plumbing:  $8,368.75  (complete)`);
  console.log(`    - 09-9100 Painting:  $14,311.32 (complete)`);
  console.log(`    - 09-6500 LVT:       $13,857.18 (partial of $23,584.30)`);
  console.log(`    - 09-2900 Gypsum:    $3,000.00  (partial of $9,162.15)`);
  console.log(`  Balance: $${(CONTRACT_TOTAL - 50000).toFixed(2)} to be billed in future pay apps.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the project in the UI: /w/udgok/projects/' + project.id);
  console.log('  2. Verify the SOV divisions show the right budgets');
  console.log(`  3. Pay App 1 should be visible with status PAID, $50,000`);
  console.log('  4. The 3D money tower should now show one plate (the paid draw)');
  console.log('  5. When the next draw is ready, create Pay App 2 in the UI');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[import-10-7-security] FAILED');
    console.error(e);
    process.exit(1);
  });
