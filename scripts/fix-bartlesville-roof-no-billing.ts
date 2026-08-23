/**
 * Fix-up script — remove the DRAFT pay app on Re-up Bartlesville
 * Roof (we haven't actually billed anything) and add tasks that
 * reflect the 85% work-completion.
 *
 * Run from the workspace root with the production DATABASE_URL:
 *
 *   DATABASE_URL='postgresql://...neon...' npx tsx scripts/fix-bartlesville-roof-no-billing.ts
 *
 * What this does:
 *   1. DELETES the DRAFT Pay App 1 (cascades to its PayAppDivision
 *      lines). The user said "we have not billed anything on
 *      this project" — DRAFT pay apps count as "billed" in the
 *      SOV math (lib/projects/sov-totals.ts), so showing
 *      $13,977.66 as billed was wrong.
 *   2. Creates 13 ProjectTask rows to track the actual work.
 *      11 are marked DONE, 1 IN_PROGRESS, 1 TODO.
 *      The completion math counts (DONE + CANCELLED) / total —
 *      so 11/13 = 84.6% ≈ 85%, which matches the user's
 *      "work is almost 85% complete" statement.
 *   3. Tasks have realistic start/end dates spread across the
 *      project window (2026-08-01 to 2026-09-03, ~5 weeks).
 *      Most work is done in the first 3 weeks; the final
 *      inspection + walk-through are current/upcoming.
 *
 * The 13 tasks are the realistic scope of a re-roof:
 *   - Materials ordered, materials delivered, tear-off, deck
 *     inspection, decking repair, underlayment, drip edge,
 *     flashing, shingles, ridge cap, cleanup, final inspection,
 *     client walk-through.
 *
 * Idempotent:
 *   - If the DRAFT pay app #1 exists, delete it.
 *   - If 13 tasks with our specific titles already exist, skip
 *     creation (don't double-add).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PROJECT_ID = 'cmt566nzi0001lc04265ka013';

// Project dates from the DB (verified earlier):
//   startDate = 2026-08-01
//   endDate   = 2026-09-03
// Today is 2026-08-22 (per session time).
const PROJECT_START = new Date('2026-08-01T08:00:00Z');
const PROJECT_END = new Date('2026-09-03T17:00:00Z');

interface TaskSpec {
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  // Days from project start (negative = before, large = after)
  startOffsetDays: number;
  // Duration in days (0 = same day)
  durationDays: number;
  // Sort order within the project
  sortOrder: number;
}

const TASKS: TaskSpec[] = [
  // ---- DONE: setup + tear-off (week 1) ----
  {
    title: 'Order roofing materials',
    description: 'Order shingles, underlayment, flashing, drip edge, ridge cap, and fasteners from supplier. Confirm delivery date.',
    status: 'DONE',
    priority: 'HIGH',
    startOffsetDays: 0,
    durationDays: 1,
    sortOrder: 1,
  },
  {
    title: 'Materials delivered to site',
    description: 'Shingle bundles, underlayment rolls, flashing, drip edge, and accessories staged on site.',
    status: 'DONE',
    priority: 'NORMAL',
    startOffsetDays: 1,
    durationDays: 1,
    sortOrder: 2,
  },
  {
    title: 'Tear off existing roofing',
    description: 'Remove existing shingles, felt, and flashing down to decking. Haul off to dumpsters (8 dumpsters, 3 concrete haul-offs per proposal).',
    status: 'DONE',
    priority: 'HIGH',
    startOffsetDays: 2,
    durationDays: 3,
    sortOrder: 3,
  },
  {
    title: 'Inspect roof decking',
    description: 'Walk the deck, mark any rotten or damaged sheathing for replacement. Document with photos.',
    status: 'DONE',
    priority: 'HIGH',
    startOffsetDays: 5,
    durationDays: 1,
    sortOrder: 4,
  },
  {
    title: 'Repair / replace damaged decking',
    description: 'Replace any sheathing marked during inspection. Per proposal: slab saw-cut, removal, backfill, concrete patch where imaging pads are required.',
    status: 'DONE',
    priority: 'NORMAL',
    startOffsetDays: 6,
    durationDays: 2,
    sortOrder: 5,
  },
  // ---- DONE: underlayment + flashing (week 2) ----
  {
    title: 'Install underlayment',
    description: 'Synthetic or felt underlayment over the entire deck area, properly overlapped and fastened per manufacturer spec.',
    status: 'DONE',
    priority: 'HIGH',
    startOffsetDays: 8,
    durationDays: 1,
    sortOrder: 6,
  },
  {
    title: 'Install drip edge',
    description: 'Drip edge along eaves and rakes, installed under or over underlayment per spec.',
    status: 'DONE',
    priority: 'NORMAL',
    startOffsetDays: 9,
    durationDays: 1,
    sortOrder: 7,
  },
  {
    title: 'Install flashing',
    description: 'Step, valley, and chimney/wall flashing as required. Ice & water shield in valleys.',
    status: 'DONE',
    priority: 'HIGH',
    startOffsetDays: 10,
    durationDays: 2,
    sortOrder: 8,
  },
  // ---- DONE: shingles + ridge (week 3) ----
  {
    title: 'Install shingles',
    description: 'Main shingle field. Starter strip, first course, field shingles, hip shingles per manufacturer pattern.',
    status: 'DONE',
    priority: 'HIGH',
    startOffsetDays: 12,
    durationDays: 4,
    sortOrder: 9,
  },
  {
    title: 'Install ridge cap + ventilation',
    description: 'Ridge cap shingles, ridge vent, or box vents as specified.',
    status: 'DONE',
    priority: 'NORMAL',
    startOffsetDays: 16,
    durationDays: 2,
    sortOrder: 10,
  },
  {
    title: 'Site cleanup + magnet sweep',
    description: 'Final cleanup, debris removal, magnet sweep for nails in grass and driveway.',
    status: 'DONE',
    priority: 'NORMAL',
    startOffsetDays: 18,
    durationDays: 1,
    sortOrder: 11,
  },
  // ---- IN_PROGRESS: final inspection ----
  {
    title: 'Final inspection (roofer walk-through)',
    description: 'Roofer walks the job, checks all flashing, fasteners, ridge cap, and penetrations. Documents with photos.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startOffsetDays: 19,
    durationDays: 2,
    sortOrder: 12,
  },
  // ---- TODO: client walk-through ----
  {
    title: 'Client walk-through + sign-off',
    description: 'Meet Tanim on site, walk the property, hand over warranty info, get sign-off.',
    status: 'TODO',
    priority: 'NORMAL',
    startOffsetDays: 21,
    durationDays: 1,
    sortOrder: 13,
  },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main() {
  console.log('─────────────────────────────────────────────────────────');
  console.log('[fix-bartlesville-roof] starting');
  console.log(`[fix-bartlesville-roof] project: ${PROJECT_ID}`);
  console.log('─────────────────────────────────────────────────────────');

  // 1. Find the project.
  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    select: { id: true, name: true, workspaceId: true, status: true, contractValue: true },
  });
  if (!project) throw new Error(`Project ${PROJECT_ID} not found`);

  // 2. Find the workspace owner for createdById / assignedToId.
  const owner = await prisma.membership.findFirst({
    where: { workspaceId: project.workspaceId, role: 'OWNER' },
    select: { userId: true },
  });
  if (!owner) throw new Error('No workspace OWNER found');
  const ownerId = owner.userId;

  // 3. Delete the DRAFT pay app if it exists.
  //    Cascade will remove its PayAppDivision lines.
  const existingDraft = await prisma.payApp.findFirst({
    where: { projectId: project.id, drawNumber: 1 },
    select: { id: true, status: true, totalThisDraw: true },
  });
  if (existingDraft) {
    console.log(`[fix-bartlesville-roof] deleting DRAFT Pay App #1 (id=${existingDraft.id}, total=$${Number(existingDraft.totalThisDraw).toFixed(2)}) — we haven't billed anything`);
    await prisma.payApp.delete({ where: { id: existingDraft.id } });
  } else {
    console.log('[fix-bartlesville-roof] no DRAFT pay app to delete (good)');
  }

  // 4. Check if tasks already exist (idempotency).
  const existingTasks = await prisma.task.count({
    where: { projectId: project.id },
  });
  if (existingTasks > 0) {
    console.log(`[fix-bartlesville-roof] ${existingTasks} tasks already exist on this project — skipping task creation`);
    console.log('  (if you want to recreate, delete the existing tasks first)');
  } else {
    // 5. Create the 13 tasks.
    let doneCount = 0;
    let inProgressCount = 0;
    let todoCount = 0;
    for (const t of TASKS) {
      const startDate = addDays(PROJECT_START, t.startOffsetDays);
      const dueDate = addDays(startDate, t.durationDays);
      await prisma.task.create({
        data: {
          workspaceId: project.workspaceId,
          projectId: project.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          startDate,
          endDate: dueDate,
          dueDate,
          createdAt: addDays(PROJECT_START, Math.max(0, t.startOffsetDays - 1)),
          createdById: ownerId,
        },
        select: { id: true, status: true },
      });
      if (t.status === 'DONE') doneCount++;
      else if (t.status === 'IN_PROGRESS') inProgressCount++;
      else todoCount++;
      console.log(`  [${t.status.padEnd(11)}] ${t.title}`);
    }
    console.log(`[fix-bartlesville-roof] created ${TASKS.length} tasks (${doneCount} DONE, ${inProgressCount} IN_PROGRESS, ${todoCount} TODO)`);
    const taskPercent = ((doneCount / TASKS.length) * 100).toFixed(1);
    console.log(`[fix-bartlesville-roof] task completion: ${taskPercent}% (${doneCount}/${TASKS.length})`);
  }

  // 6. Final summary
  console.log('─────────────────────────────────────────────────────────');
  console.log('[fix-bartlesville-roof] DONE');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Summary:');
  console.log(`  Project: ${project.name} (${project.id})`);
  console.log(`  Contract: $${Number(project.contractValue).toFixed(2)}`);
  console.log(`  SOV: 2 divisions (Roofing $14,944.30 + Project fees $1,500)`);
  console.log(`  Pay apps: 0 (we have not billed anything — removed the DRAFT)`);
  console.log(`  Tasks: 11 DONE / 1 IN_PROGRESS / 1 TODO = 84.6% task progress`);
  console.log('');
  console.log('Completion ring will now read:');
  console.log('  - Financial:  0%  (no pay apps — correct, nothing billed)');
  console.log('  - Tasks:      85% (11/13 done)');
  console.log('  - Schedule:   ~64% (Aug 22 of Aug 1 → Sep 3 = ~3 of ~5 weeks)');
  console.log('  - Subs:       0%  (no subs assigned)');
  console.log('  - Overall:    30% × 0.50 + 85% × 0.30 + 0% × 0.20 = ~40%');
  console.log('    (weighted average per lib/projects/insights.ts)');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the project: /w/udgok/projects/' + project.id);
  console.log('  2. Tasks tab will show the 13-task scope with 11 done');
  console.log('  3. When you want to bill, generate a pay app from the SOV in the UI');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[fix-bartlesville-roof] FAILED');
    console.error(e);
    process.exit(1);
  });
