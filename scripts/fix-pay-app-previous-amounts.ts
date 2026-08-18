// One-time data fix script. Recomputes every PayAppDivision's
// previousAmount and balanceAfter using CUMULATIVE billed amount
// across all prior draws (in drawNumber order), not the leftover
// balanceAfter from the last draw (the old buggy behavior).
//
// Run with:
//   DATABASE_URL=... tsx scripts/fix-pay-app-previous-amounts.ts
//
// OR
//   npx prisma db execute --file scripts/fix-pay-app-previous-amounts.sql
//
// The script is idempotent: running it again produces the same result.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[fix-pay-app-previous-amounts] starting...');

  // Fetch every project that has pay apps
  const projects = await prisma.project.findMany({
    where: { payApps: { some: {} } },
    select: { id: true, name: true, contractValue: true },
  });
  console.log(`[fix-pay-app-previous-amounts] ${projects.length} projects to check`);

  let totalFixed = 0;
  let totalPayApps = 0;

  for (const project of projects) {
    // Fetch every pay app for this project, ordered by draw number
    const payApps = await prisma.payApp.findMany({
      where: { projectId: project.id },
      orderBy: { drawNumber: 'asc' },
      include: { divisions: true },
    });
    if (payApps.length === 0) continue;
    totalPayApps += payApps.length;

    // Fetch every project division with its budget (for the contract total
    // and the per-division balance calculation)
    const projectDivisions = await prisma.projectDivision.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: 'asc' },
    });
    const totalContract = projectDivisions.reduce(
      (acc, d) => acc + Number(d.budget),
      0,
    );

    // cumulativeByDiv[divisionId] = total thisDrawAmount billed so far
    const cumulativeByDiv = new Map<string, number>();
    for (const div of projectDivisions) {
      cumulativeByDiv.set(div.id, 0);
    }

    for (const payApp of payApps) {
      // For each PayAppDivision on this pay app, compute the new
      // previousAmount (cumulative billed BEFORE this draw) and
      // the new balanceAfter (budget - previousAmount - thisDraw).
      let lineTotalPrevious = 0;
      let lineTotalThisDraw = 0;
      let lineTotalBalance = 0;

      // Update each PayAppDivision row
      for (const line of payApp.divisions) {
        const previousAmount = cumulativeByDiv.get(line.projectDivisionId) ?? 0;
        const thisDraw = Number(line.thisDrawAmount);
        const budget =
          Number(
            projectDivisions.find((d) => d.id === line.projectDivisionId)?.budget ?? 0,
          );
        const balanceAfter = Math.max(0, budget - previousAmount - thisDraw);

        await prisma.payAppDivision.update({
          where: { id: line.id },
          data: { previousAmount, balanceAfter },
        });

        // Add this draw's amount to the cumulative
        cumulativeByDiv.set(
          line.projectDivisionId,
          previousAmount + thisDraw,
        );

        lineTotalPrevious += previousAmount;
        lineTotalThisDraw += thisDraw;
        lineTotalBalance += balanceAfter;
        totalFixed++;
      }

      // Update the parent PayApp totals so the list page shows the right math
      const totalBalance = totalContract - lineTotalPrevious - lineTotalThisDraw;
      await prisma.payApp.update({
        where: { id: payApp.id },
        data: {
          totalContract,
          totalPrevious: lineTotalPrevious,
          totalThisDraw: lineTotalThisDraw,
          totalBalance: Math.max(0, totalBalance),
        },
      });
    }

    console.log(
      `[fix-pay-app-previous-amounts] ${project.name}: ${payApps.length} pay apps recomputed`,
    );
  }

  console.log(
    `[fix-pay-app-previous-amounts] done. ${totalPayApps} pay apps, ${totalFixed} lines updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[fix-pay-app-previous-amounts] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
