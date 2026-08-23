/**
 * One-time import script — populate Re-up Bartlesville Roof
 * with the roofing breakdown + an 85% DRAFT Pay App.
 *
 * Run from the workspace root with the production DATABASE_URL:
 *
 *   DATABASE_URL='postgresql://...neon...' npx tsx scripts/import-bartlesville-roof-invoice.ts
 *
 * What this script does:
 *   1. Creates 2 ProjectDivision rows on the project:
 *        - 07-5000 Roofing:         $14,944.30 (material $8,944.30 + labor $6,000)
 *        - 01-9000 Project fees:    $1,500.00   (UDGOK fee, standalone line)
 *   2. Contract value is already $16,444.30 in the DB and matches
 *      the user's math ($8,944.30 + $6,000 + $1,500 = $16,444.30),
 *      so we don't change it.
 *   3. Creates Pay App 1 as DRAFT for 85% of the contract
 *      ($13,977.66), allocated to 07-5000 Roofing. This:
 *        - Records the 85% work-completion in the financial rollup
 *          (lib/projects/sov-totals.ts counts DRAFT pay apps as
 *          "billed", so the project shows 85% financial progress)
 *        - Stays DRAFT because the user said client hasn't paid
 *          anything — we don't want to mark a pay app as SENT
 *          or PAID when no money has actually been received
 *        - When the user wants to bill, they review the draft in
 *          the UI, adjust if needed, and hit Send
 *
 * The script is IDEMPOTENT on divisions (uses upsert by code)
 * and skips Pay App 1 if one already exists.
 *
 * Notes on progress:
 *   - The completion ring is computed from financial + tasks +
 *     schedule + subs. With 85% financial and no tasks/subs,
 *     the overall % will be lower than 85 — that's expected
 *     and is the right signal ("financially we're 85% there,
 *     but we haven't logged the work as tasks yet"). If the
 *     user wants the overall % to read higher, they can add
 *     tasks and mark them done.
 */

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateShareToken() {
  return randomBytes(24).toString('base64url');
}

const PROJECT_ID = 'cmt566nzi0001lc04265ka013';
const CONTRACT_TOTAL = 16444.30; // already set on the project, matches $8,944.30 + $6,000 + $1,500

// Division structure. We bundle material + labor into a single
// "Roofing" division because the project has no separate trade
// codes for material vs labor. The notes record the breakdown.
const DIVISIONS: Array<{ code: string; trade: string; budget: number; note: string; sortOrder: number }> = [
  {
    code: '07-5000',
    trade: 'Roofing',
    budget: 14944.30, // 8944.30 material + 6000 labor
    note: 'Bundle: Roofing material $8,944.30 + Roofing labor (paid to roofer) $6,000.00 = $14,944.30. Material + labor combined because project has no separate mat/labor trade codes.',
    sortOrder: 75,
  },
  {
    code: '01-9000',
    trade: 'Project fees',
    budget: 1500.00,
    note: 'UDGOK project fees (standalone line per user request).',
    sortOrder: 19,
  },
];

// Pay App 1 — 85% DRAFT.
// Math: 85% of $16,444.30 = $13,977.655 → rounded to $13,977.66
const PROGRESS_PERCENT = 0.85;
const PAY_APP_1_TOTAL = Math.round(CONTRACT_TOTAL * PROGRESS_PERCENT * 100) / 100;

const PAY_APP_1_LINES: Array<{ code: string; thisDraw: number; note: string }> = [
  {
    code: '07-5000',
    thisDraw: PAY_APP_1_TOTAL,
    note: '85% of contract value. Represents roofing work completed to date. Stays DRAFT until client is invoiced.',
  },
];

async function main() {
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-bartlesville-roof] starting');
  console.log(`[import-bartlesville-roof] project: ${PROJECT_ID}`);
  console.log(`[import-bartlesville-roof] contract total: $${CONTRACT_TOTAL.toFixed(2)}`);
  console.log(`[import-bartlesville-roof] pay app 1 (85% DRAFT): $${PAY_APP_1_TOTAL.toFixed(2)}`);
  console.log('─────────────────────────────────────────────────────────');

  // 1. Find the project.
  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      contractValue: true,
      status: true,
      startDate: true,
      divisions: { select: { id: true, code: true, trade: true, budget: true } },
    },
  });
  if (!project) {
    throw new Error(`Project ${PROJECT_ID} not found`);
  }
  console.log(`[import-bartlesville-roof] found project: ${project.name} (status=${project.status})`);
  console.log(`[import-bartlesville-roof] workspace: ${project.workspaceId}`);
  console.log(`[import-bartlesville-roof] existing divisions: ${project.divisions.length}`);

  // 2. Find the workspace owner to use as createdById.
  const owner = await prisma.membership.findFirst({
    where: { workspaceId: project.workspaceId, role: 'OWNER' },
    select: { userId: true },
  });
  if (!owner) {
    throw new Error(`No workspace OWNER found for workspace ${project.workspaceId}. Cannot create pay apps without a user ID.`);
  }
  const createdById = owner.userId;
  console.log(`[import-bartlesville-roof] using createdById=${createdById} (workspace OWNER)`);

  // 3. Upsert divisions by code.
  //    Idempotent: existing rows get their budget updated,
  //    new rows get created.
  for (const d of DIVISIONS) {
    const existing = project.divisions.find((pd) => pd.code === d.code);
    if (existing) {
      await prisma.projectDivision.update({
        where: { id: existing.id },
        data: { budget: d.budget, trade: d.trade, sortOrder: d.sortOrder },
      });
      console.log(`[import-bartlesville-roof] updated division ${d.code} ${d.trade}: $${d.budget.toFixed(2)}`);
    } else {
      const created = await prisma.projectDivision.create({
        data: {
          projectId: project.id,
          code: d.code,
          trade: d.trade,
          budget: d.budget,
          sortOrder: d.sortOrder,
        },
        select: { id: true },
      });
      console.log(`[import-bartlesville-roof] created division ${d.code} ${d.trade}: $${d.budget.toFixed(2)} (id=${created.id})`);
    }
  }

  // 4. Verify contract value matches. Don't overwrite if it
  //    does — the user may have a custom value. Only update
  //    if the current value is null or zero.
  if (project.contractValue == null || Number(project.contractValue) === 0) {
    await prisma.project.update({
      where: { id: project.id },
      data: { contractValue: CONTRACT_TOTAL },
    });
    console.log(`[import-bartlesville-roof] contractValue → $${CONTRACT_TOTAL.toFixed(2)}`);
  } else if (Math.abs(Number(project.contractValue) - CONTRACT_TOTAL) > 0.01) {
    console.log(`[import-bartlesville-roof] ⚠ contractValue is $${Number(project.contractValue).toFixed(2)}, expected $${CONTRACT_TOTAL.toFixed(2)} — leaving as-is`);
  } else {
    console.log(`[import-bartlesville-roof] contractValue already $${CONTRACT_TOTAL.toFixed(2)} ✓`);
  }

  // 5. Create Pay App 1 — DRAFT, 85% of contract.
  //    Skip if draw 1 already exists.
  const existingDraw1 = await prisma.payApp.findFirst({
    where: { projectId: project.id, drawNumber: 1 },
    select: { id: true, status: true, totalThisDraw: true },
  });
  if (existingDraw1) {
    console.log(`[import-bartlesville-roof] draw 1 already exists (id=${existingDraw1.id}, status=${existingDraw1.status}, total=$${Number(existingDraw1.totalThisDraw).toFixed(2)}) — skipping`);
  } else {
    const totalThisDraw = PAY_APP_1_LINES.reduce((a, l) => a + l.thisDraw, 0);
    const totalBalance = CONTRACT_TOTAL - totalThisDraw;
    const totalPrevious = 0; // first draw

    const payApp1 = await prisma.payApp.create({
      data: {
        projectId: project.id,
        drawNumber: 1,
        periodStart: project.startDate ?? new Date(),
        periodEnd: new Date(),
        status: 'DRAFT',
        totalContract: CONTRACT_TOTAL,
        totalPrevious,
        totalThisDraw,
        totalBalance,
        notes: `Pay App 1 — 85% of contract value ($${CONTRACT_TOTAL.toFixed(2)}). Represents work completed to date per user instruction ("work is almost 85% complete"). Client has not paid anything yet, so this stays DRAFT. Allocation: 100% to 07-5000 Roofing. Project fees ($1,500, in 01-9000) not yet billed. Review and Send when ready to invoice.`,
        shareToken: generateShareToken(),
        createdById,
      },
      select: { id: true, shareToken: true },
    });
    console.log(`[import-bartlesville-roof] created Pay App 1 (id=${payApp1.id}, status=DRAFT, total=$${totalThisDraw.toFixed(2)}, balance=$${totalBalance.toFixed(2)})`);

    // 6. Create PayAppDivision lines.
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
      console.log(`[import-bartlesville-roof]   line: ${line.code} $${line.thisDraw.toFixed(2)} (balance after: $${balanceAfter.toFixed(2)})`);
    }
    console.log(`[import-bartlesville-roof] created ${PAY_APP_1_LINES.length} PayAppDivision rows for Pay App 1`);
  }

  // 7. Final summary
  console.log('─────────────────────────────────────────────────────────');
  console.log('[import-bartlesville-roof] DONE');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Summary:');
  console.log(`  Project: ${project.name} (${project.id})`);
  console.log(`  Client: Tanim Haq`);
  console.log(`  Status: ${project.status}`);
  console.log(`  Contract: $${CONTRACT_TOTAL.toFixed(2)}`);
  console.log(`    - 07-5000 Roofing: $14,944.30  (mat $8,944.30 + labor $6,000)`);
  console.log(`    - 01-9000 Project fees: $1,500  (standalone line)`);
  console.log(`  Pay App 1: $${PAY_APP_1_TOTAL.toFixed(2)} DRAFT (85% of contract)`);
  console.log(`    - 07-5000 Roofing: $${PAY_APP_1_TOTAL.toFixed(2)} (85% drawn)`);
  console.log(`  Balance: $${(CONTRACT_TOTAL - PAY_APP_1_TOTAL).toFixed(2)} (15% — final retainage + project fees)`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the project in the UI: /w/udgok/projects/' + project.id);
  console.log('  2. SOV tab will show 2 divisions (Roofing, Project fees) totaling $' + CONTRACT_TOTAL.toFixed(2));
  console.log('  3. Pay Apps tab will show the 85% draft — review and click Send when ready to invoice');
  console.log('  4. The completion ring will read ~21% overall (financial 85% / 4 metrics averaged)');
  console.log('     — to read higher, add tasks under Tasks tab and mark some as DONE');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[import-bartlesville-roof] FAILED');
    console.error(e);
    process.exit(1);
  });
