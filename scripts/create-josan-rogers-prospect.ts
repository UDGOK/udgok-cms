/**
 * One-time script — create a PROSPECT project for Gurmeet Josan
 * (security camera install at a multifamily in Rogers, AR).
 *
 * Run from the workspace root with the production DATABASE_URL:
 *
 *   DATABASE_URL='postgresql://...neon...' npx tsx scripts/create-josan-rogers-prospect.ts
 *
 * Background:
 *   The user has a brand-new project still in "talking stages".
 *   We just added PROSPECT to the ProjectStatus enum so this
 *   state is first-class — visually distinct from ACTIVE work
 *   (indigo marker / indigo badge) and not treated as a stalled
 *   ACTIVE project (no "no pay apps in 30 days" warning, etc).
 *
 * What this does:
 *   1. Creates a Project row with status=PROSPECT, linked to
 *      the Gurmeet Josan client, in the UDGOK workspace.
 *   2. Sets city=Rogers, state=AR, no address yet (the user
 *      doesn't have it). No contract value, no start/end dates.
 *   3. Sets a description with the early-stage notes so anyone
 *      opening the project knows what's been discussed and
 *      what's still missing.
 *   4. Adds 1 TODO task to capture the next step (site walk
 *      with Gurmeet) so the project has something in the
 *      Tasks tab to anchor the "next action" thinking.
 *
 * Idempotent: skipped if a PROSPECT project already exists for
 * this client.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLIENT_ID = 'cmt56kvi40001jr04fvwiuhbf';
const PROJECT_NAME = 'Rogers Multifamily Security Cameras';
const PROJECT_DESCRIPTION = [
  'Security camera installation at a multifamily property in Rogers, AR.',
  '',
  'Early-stage conversation with Gurmeet Josan — no contract, no',
  'scope detail, no address yet. Will firm up after a site walk',
  'and a conversation about camera count, coverage areas, NVR',
  'placement, and whether the install is interior-only or includes',
  'parking lot / building exterior.',
  '',
  'Things to capture in a follow-up:',
  '  • Site address (multifamily property in Rogers, AR)',
  '  • Building count + unit count',
  '  • Existing infrastructure (cameras, NVR, conduit, switches)',
  '  • Power availability at proposed camera locations',
  '  • Network drop / internet at NVR location',
  '  • Client preference: cloud vs. local NVR',
  '  • HOA / property management approval process (if any)',
  '  • Estimated install date',
].join('\n');

async function main() {
  console.log('─────────────────────────────────────────────────────────');
  console.log('[create-josan-rogers-prospect] starting');
  console.log(`[create-josan-rogers-prospect] client: ${CLIENT_ID}`);
  console.log('─────────────────────────────────────────────────────────');

  // 1. Find the client.
  const client = await prisma.client.findUnique({
    where: { id: CLIENT_ID },
    include: { workspace: { select: { id: true, slug: true } } },
  });
  if (!client) throw new Error(`Client ${CLIENT_ID} not found`);
  console.log(`[create-josan-rogers-prospect] client: ${client.name} (workspace=${client.workspace.slug})`);

  // 2. Idempotency: skip if a PROSPECT project already exists for this client.
  const existing = await prisma.project.findFirst({
    where: { clientId: CLIENT_ID, status: 'PROSPECT' },
    select: { id: true, name: true },
  });
  if (existing) {
    console.log(`[create-josan-rogers-prospect] a PROSPECT project already exists for this client: "${existing.name}" (id=${existing.id}) — skipping`);
    await prisma.$disconnect();
    return;
  }

  // 3. Create the project.
  const project = await prisma.project.create({
    data: {
      workspaceId: client.workspaceId,
      clientId: client.id,
      name: PROJECT_NAME,
      description: PROJECT_DESCRIPTION,
      status: 'PROSPECT',
      // Location — city + state are confirmed; address TBD
      // (user will capture during site walk).
      address: null,
      city: 'Rogers',
      state: 'AR',
      zip: null,
      // No contract value, no dates — the whole point of PROSPECT.
      contractValue: null,
      startDate: null,
      endDate: null,
      // No coords yet (no address to geocode). User can drop
      // a manual pin in the UI when they have the site address.
      latitude: null,
      longitude: null,
    },
    select: { id: true, name: true, status: true, city: true, state: true },
  });
  console.log(`[create-josan-rogers-prospect] created project: "${project.name}" (id=${project.id})`);
  console.log(`[create-josan-rogers-prospect]   status=${project.status}, location=${project.city}, ${project.state}`);

  // 4. Find the workspace owner (for createdById on the task).
  const owner = await prisma.membership.findFirst({
    where: { workspaceId: client.workspaceId, role: 'OWNER' },
    select: { userId: true },
  });
  if (!owner) {
    console.log('[create-josan-rogers-prospect] ⚠ no workspace OWNER found — skipping task creation');
  } else {
    // 5. Add a single TODO task: "Site walk with Gurmeet".
    //    Gives the project a next action in the Tasks tab
    //    and a hook for the team to track the conversation.
    const task = await prisma.task.create({
      data: {
        workspaceId: client.workspaceId,
        projectId: project.id,
        title: 'Site walk with Gurmeet — confirm scope + address',
        description: [
          'Walk the multifamily property with Gurmeet to capture:',
          '  • Exact site address (needed for geocode + permit portal)',
          '  • Building / unit count',
          '  • Existing infrastructure (cameras, NVR, conduit, switches)',
          '  • Power + network at proposed camera locations',
          '  • NVR placement (interior telecom closet vs. exterior cabinet)',
          '  • Cloud vs. local NVR preference',
          '  • HOA / property management approval process',
          '',
          'Bring: walkie, tape measure, ladder, phone with photos app,',
          'sample camera cut sheets.',
        ].join('\n'),
        status: 'TODO',
        priority: 'HIGH',
        dueDate: null,
        createdById: owner.userId,
      },
      select: { id: true, status: true },
    });
    console.log(`[create-josan-rogers-prospect] created TODO task (id=${task.id}, status=${task.status})`);
  }

  console.log('─────────────────────────────────────────────────────────');
  console.log('[create-josan-rogers-prospect] DONE');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Summary:');
  console.log(`  Project: ${PROJECT_NAME}`);
  console.log(`  ID:      ${project.id}`);
  console.log(`  Status:  PROSPECT (indigo badge, not counted as live work)`);
  console.log(`  Client:  ${client.name} (josan_gurmeet@yahoo.com)`);
  console.log(`  Location: Rogers, AR (address TBD)`);
  console.log(`  Contract value: none (not yet signed)`);
  console.log(`  Tasks: 1 TODO (site walk with Gurmeet)`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open: /w/udgok/projects/' + project.id);
  console.log('  2. The project will show with a PROSPECT (indigo) badge');
  console.log('  3. The 3D map (if Rogers coords are added) will show an indigo pin,');
  console.log('     visually distinct from the orange ACTIVE pins');
  console.log('  4. Once the contract is signed, change status to ACTIVE in the UI');
  console.log('     — at that point the SOV / pay apps / tasks become live work');

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[create-josan-rogers-prospect] FAILED');
    console.error(e);
    process.exit(1);
  });
