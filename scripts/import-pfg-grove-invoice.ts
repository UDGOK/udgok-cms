/**
 * One-time import script — populate PFG — Grove with INV-2026-0729-GRV.
 *
 * Run from the workspace root with the production DATABASE_URL:
 *
 *   DATABASE_URL='postgresql://...neon...' npx tsx scripts/import-pfg-grove-invoice.ts
 *
 * Pull the DATABASE_URL from Vercel:
 *   - Vercel dashboard → cms.udgok.com → Settings → Environment Variables
 *   - Show value of DATABASE_URL (it's the Neon connection string)
 *
 * What this script does:
 *   1. Finds the PFG — Grove project (by name)
 *   2. Ensures ProjectDivision rows exist for each trade:
 *        04  — Masonry                       (paid on invoice)
 *        06  — Wood/Plastics/Composites      (paid on invoice)
 *        07  — Thermal & Moisture Protection (paid on invoice)
 *        03  — Concrete                      (concrete + rebar + labor, pay app 2)
 *        02  — Demolition                    (demo, pay app 2)
 *   3. Creates Pay App 1 (draw 1) with status=PAID, payment
 *      date = 2 weeks ago. Three PayAppDivision lines for
 *      the invoice breakdown. Note attached with the invoice
 *      number so the audit trail ties back.
 *   4. Creates Pay App 2 (draw 2) with status=DRAFT for the
 *      unpaid work:
 *        - Concrete     140 yd × $175      = $24,500
 *        - Rebar         2 bundles         = $3,900
 *        - Demo                            = $4,900
 *        - Concrete Labor                  = $23,000
 *      Total: $56,300
 *
 * The script is IDEMPOTENT:
 *   - Division creation is skipped if a row with the same
 *     code already exists on the project
 *   - Pay app creation is skipped if a draw with the same
 *     number already exists on the project
 *
 * Side effects on the project:
 *   - ProjectDivision budget is left as 0 for new divisions
 *     (the buyer can set budgets in the UI after running)
 *   - The contract value on the project is left untouched
 *   - The first workspace owner is used as createdById
 *
 * The script is safe to run twice. Re-running prints what
 * it skipped vs. what it created.
 */

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateShareToken() {
  return randomBytes(24).toString('base64url');
}

const INVOICE_NUMBER = 'INV-2026-0729-GRV';
const INVOICE_DATE = new Date('2026-07-29T00:00:00Z');
// 2 weeks before "now" — using the time the script is run.
// The user said the client paid 2 weeks ago, so we set
// paymentDate = (script run time - 14 days).
const PAYMENT_DATE = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

const INVOICE_DIVISIONS: Array<{
  code: string;
  trade: string;
  thisDraw: number;
  // Optional human-readable note
  note?: string;
}> = [
  {
    code: '04',
    trade: 'Masonry',
    thisDraw: 4022.0,
    note: 'Stone repair + replacement stone (lump + material)',
  },
  {
    code: '06',
    trade: 'Wood, Plastics & Composites',
    thisDraw: 4712.0,
    note: 'Sheathing labor + material',
  },
  {
    code: '07',
    trade: 'Thermal & Moisture Protection',
    thisDraw: 8680.0,
    note: 'EIFS + plywood install (lump sum, finish color 3044 Ramie)',
  },
];

const INVOICE_CONTRACTOR_FEE = 1393.12; // 8% of subtotal
const INVOICE_SUBTOTAL = 17414.0;
const INVOICE_TOTAL = 18807.12;

// Pay App 2 — unpaid work. We add new divisions for these
// (they were not on the original invoice).
const PAY_APP_2_DIVISIONS: Array<{
  code: string;
  trade: string;
  thisDraw: number;
  note: string;
}> = [
  {
    code: '03',
    trade: 'Concrete',
    thisDraw: 24500.0, // 140 yd × $175
    note: '140 yd @ $175/yd',
  },
  {
    code: '03R',
    trade: 'Rebar',
    thisDraw: 3900.0,
    note: '2 bundles of #3 rebar',
  },
  {
    code: '02',
    trade: 'Demolition',
    thisDraw: 4900.0,
    note: 'Demo work',
  },
  {
    code: '03L',
    trade: 'Concrete Labor',
    thisDraw: 23000.0,
    note: 'Concrete labor',
  },
];

async function main() {
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-pfg-grove-invoice] starting');
  console.log(`[import-pfg-grove-invoice] invoice: ${INVOICE_NUMBER}`);
  console.log(`[import-pfg-grove-invoice] invoice date: ${INVOICE_DATE.toISOString()}`);
  console.log(`[import-pfg-grove-invoice] payment date: ${PAYMENT_DATE.toISOString()}`);
  console.log('─────────────────────────────────────────────────────────');

  // 1. Find the project. Try several name patterns because
  // the user may have entered "PFG - Grove", "PFG — Grove",
  // "Grove Store", or the address.
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { name: { contains: 'Grove', mode: 'insensitive' } },
        { name: { contains: 'PFG', mode: 'insensitive' } },
        { address: { contains: 'Main', mode: 'insensitive' } },
        { city: { contains: 'Grove', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      contractValue: true,
      address: true,
      city: true,
      state: true,
    },
  });

  if (!project) {
    throw new Error(
      'Project PFG — Grove not found. Check that the project exists and the name matches (script searches for "Grove" or "PFG" in the project name, or "Grove" in the city, or "Main" in the address).',
    );
  }
  console.log(`[import-pfg-grove-invoice] found project: ${project.name} (id=${project.id})`);
  console.log(`[import-pfg-grove-invoice] workspace: ${project.workspaceId}`);
  if (project.address) console.log(`[import-pfg-grove-invoice] address: ${project.address}, ${project.city ?? ''}, ${project.state ?? ''}`);

  // 2. Find the workspace owner (or any OWNER) to use as
  // createdById. Pay app actions require a real user ID.
  const owner = await prisma.membership.findFirst({
    where: { workspaceId: project.workspaceId, role: 'OWNER' },
    select: { userId: true },
  });
  if (!owner) {
    throw new Error(`No workspace OWNER found for workspace ${project.workspaceId}. Cannot create pay apps without a user ID.`);
  }
  const createdById = owner.userId;
  console.log(`[import-pfg-grove-invoice] using createdById=${createdById} (workspace OWNER)`);

  // 3. Ensure ProjectDivision rows exist for the invoice trades.
  //    Idempotent: if a row with the same code exists, skip.
  const divisionByCode = new Map<string, string>(); // code → divisionId
  for (const d of INVOICE_DIVISIONS) {
    const existing = await prisma.projectDivision.findFirst({
      where: { projectId: project.id, code: d.code },
      select: { id: true },
    });
    if (existing) {
      console.log(`[import-pfg-grove-invoice] division ${d.code} ${d.trade} already exists (id=${existing.id})`);
      divisionByCode.set(d.code, existing.id);
      continue;
    }
    const created = await prisma.projectDivision.create({
      data: {
        projectId: project.id,
        code: d.code,
        trade: d.trade,
        budget: 0, // Buyer sets budgets in the UI
        sortOrder: parseInt(d.code, 10) || 999,
      },
      select: { id: true },
    });
    console.log(`[import-pfg-grove-invoice] created division ${d.code} ${d.trade} (id=${created.id})`);
    divisionByCode.set(d.code, created.id);
  }

  // 4. Pay App 1 — the invoice.
  //    Skip if draw 1 already exists.
  const existingDraw1 = await prisma.payApp.findFirst({
    where: { projectId: project.id, drawNumber: 1 },
    select: { id: true, status: true },
  });
  if (existingDraw1) {
    console.log(`[import-pfg-grove-invoice] draw 1 already exists (id=${existingDraw1.id}, status=${existingDraw1.status}) — skipping`);
  } else {
    // periodStart = invoice date, periodEnd = payment date
    // (the work was done in the invoice-to-payment window)
    const totalThisDraw = INVOICE_TOTAL;
    const totalContract = INVOICE_TOTAL; // v1: contract = first draw total
    const totalBalance = 0; // fully paid

    const payApp1 = await prisma.payApp.create({
      data: {
        projectId: project.id,
        drawNumber: 1,
        periodStart: INVOICE_DATE,
        periodEnd: PAYMENT_DATE,
        status: 'PAID',
        totalContract,
        totalPrevious: 0,
        totalThisDraw,
        totalBalance,
        notes: `Invoice ${INVOICE_NUMBER} (issued ${INVOICE_DATE.toISOString().slice(0, 10)}). Subtotal $${INVOICE_SUBTOTAL.toFixed(2)} + 8% contractor fee $${INVOICE_CONTRACTOR_FEE.toFixed(2)} = $${INVOICE_TOTAL.toFixed(2)}. Client paid in full on ${PAYMENT_DATE.toISOString().slice(0, 10)} (per Yuba Parajuli, PFG corporate).`,
        shareToken: generateShareToken(),
        sentAt: INVOICE_DATE, // we treat the invoice-issued date as the send date
        sentToEmail: 'yuba@pfgstores.com',
        acknowledgedAt: PAYMENT_DATE,
        acknowledgedByEmail: 'yuba@pfgstores.com',
        acknowledgedByName: 'Yuba Parajuli',
        firstViewedAt: INVOICE_DATE,
        viewCount: 1,
        createdById,
      },
      select: { id: true, shareToken: true },
    });
    console.log(`[import-pfg-grove-invoice] created Pay App 1 (id=${payApp1.id}, status=PAID, total=$${INVOICE_TOTAL.toFixed(2)})`);

    // Create PayAppDivision rows. previousAmount = 0 (first draw).
    // balanceAfter = 0 because the total is fully paid.
    let sortOrder = 0;
    for (const d of INVOICE_DIVISIONS) {
      const divisionId = divisionByCode.get(d.code);
      if (!divisionId) {
        throw new Error(`Internal error: division ${d.code} not in map after creation`);
      }
      await prisma.payAppDivision.create({
        data: {
          payAppId: payApp1.id,
          projectDivisionId: divisionId,
          previousAmount: 0,
          thisDrawAmount: d.thisDraw,
          balanceAfter: 0, // fully paid
          sortOrder: sortOrder++,
        },
      });
    }
    console.log(`[import-pfg-grove-invoice] created ${INVOICE_DIVISIONS.length} PayAppDivision rows for Pay App 1`);
  }

  // 5. Pay App 2 — draft for the unpaid work.
  //    Skip if draw 2 already exists.
  const existingDraw2 = await prisma.payApp.findFirst({
    where: { projectId: project.id, drawNumber: 2 },
    select: { id: true, status: true },
  });
  if (existingDraw2) {
    console.log(`[import-pfg-grove-invoice] draw 2 already exists (id=${existingDraw2.id}, status=${existingDraw2.status}) — skipping`);
  } else {
    // Ensure Pay App 2 divisions exist (these are new trades
    // not in the original invoice).
    const payApp2DivisionByCode = new Map<string, string>();
    let nextSortOrder = 100; // start pay app 2's divisions after pay app 1's
    for (const d of PAY_APP_2_DIVISIONS) {
      const existing = await prisma.projectDivision.findFirst({
        where: { projectId: project.id, code: d.code },
        select: { id: true },
      });
      let divisionId: string;
      if (existing) {
        console.log(`[import-pfg-grove-invoice] division ${d.code} ${d.trade} already exists (id=${existing.id})`);
        divisionId = existing.id;
      } else {
        const created = await prisma.projectDivision.create({
          data: {
            projectId: project.id,
            code: d.code,
            trade: d.trade,
            budget: 0,
            sortOrder: nextSortOrder++,
          },
          select: { id: true },
        });
        console.log(`[import-pfg-grove-invoice] created division ${d.code} ${d.trade} (id=${created.id})`);
        divisionId = created.id;
      }
      payApp2DivisionByCode.set(d.code, divisionId);
    }

    // Pay App 2 totals. totalContract is the buyer's running
    // contract — we set it to the cumulative (draw 1 + draw 2)
    // so the balance makes sense. Buyer can adjust in the UI.
    const draw2Total = PAY_APP_2_DIVISIONS.reduce((a, d) => a + d.thisDraw, 0);
    const totalContract = INVOICE_TOTAL + draw2Total;
    const totalPrevious = INVOICE_TOTAL; // Pay App 1's total
    const totalBalance = draw2Total; // what's left to bill

    const payApp2 = await prisma.payApp.create({
      data: {
        projectId: project.id,
        drawNumber: 2,
        periodStart: PAYMENT_DATE,
        periodEnd: new Date(),
        status: 'DRAFT',
        totalContract,
        totalPrevious,
        totalThisDraw: draw2Total,
        totalBalance,
        notes: 'Pay App 2 — concrete, rebar, demo, concrete labor. Not yet billed to client; will go out when the concrete work is complete.',
        shareToken: generateShareToken(),
        createdById,
      },
      select: { id: true, shareToken: true },
    });
    console.log(`[import-pfg-grove-invoice] created Pay App 2 (id=${payApp2.id}, status=DRAFT, total=$${draw2Total.toFixed(2)})`);

    let sortOrder = 0;
    for (const d of PAY_APP_2_DIVISIONS) {
      const divisionId = payApp2DivisionByCode.get(d.code);
      if (!divisionId) {
        throw new Error(`Internal error: Pay App 2 division ${d.code} not in map after creation`);
      }
      await prisma.payAppDivision.create({
        data: {
          payAppId: payApp2.id,
          projectDivisionId: divisionId,
          previousAmount: 0, // first time this division is billed
          thisDrawAmount: d.thisDraw,
          balanceAfter: d.thisDraw, // full balance remains until paid
          sortOrder: sortOrder++,
        },
      });
    }
    console.log(`[import-pfg-grove-invoice] created ${PAY_APP_2_DIVISIONS.length} PayAppDivision rows for Pay App 2`);
  }

  // 6. Final summary
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-pfg-grove-invoice] DONE');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Next steps:');
  console.log('  1. Open the project in the UI: /w/<slug>/projects/<id>');
  console.log('  2. Verify the divisions and pay apps are listed correctly');
  console.log('  3. Set the project.contractValue if it should be the');
  console.log('     full $75,107.12 (Pay App 1 + Pay App 2)');
  console.log('  4. Set the division budgets (currently 0)');
  console.log('  5. Review Pay App 2 in the UI and click Send when');
  console.log('     you\'re ready to bill the client for the concrete work');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[import-pfg-grove-invoice] FAILED');
    console.error(e);
    process.exit(1);
  });
