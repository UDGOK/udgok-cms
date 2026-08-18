/**
 * One-time backfill: geocode every project that has an address but
 * no lat/lng yet. Idempotent — projects that already have coords
 * are skipped unless --force is passed.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-geocode.ts
 *   pnpm tsx scripts/backfill-geocode.ts --force
 *   pnpm tsx scripts/backfill-geocode.ts --workspace=<id>
 *
 * Paces at ~1 req/sec to respect Nominatim's usage policy.
 */

import { PrismaClient } from '@prisma/client';
import { nominatimGeocode, sleep } from '../lib/geocoding/nominatim';

const prisma = new PrismaClient();

function buildQuery(parts: {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}): string {
  return [parts.address, parts.city, parts.state, parts.zip]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) => p.trim())
    .join(', ');
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const workspaceArg = args.find((a) => a.startsWith('--workspace='));
  const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : undefined;

  const where: Record<string, unknown> = {
    address: { not: null },
  };
  if (workspaceId) where.workspaceId = workspaceId;
  if (!force) {
    where.latitude = null;
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      latitude: true,
      geocodedAddress: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${projects.length} project(s) to geocode${force ? ' (forced)' : ''}.`);

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const failures: { name: string; query: string; reason: string }[] = [];

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const query = buildQuery(p);
    if (!query) {
      skipped++;
      console.log(`[${i + 1}/${projects.length}] ${p.name} — no address, skipped`);
      continue;
    }

    process.stdout.write(`[${i + 1}/${projects.length}] ${p.name} — "${query}" ... `);
    const geo = await nominatimGeocode(query, { countryCode: 'us' });

    if (!geo) {
      failed++;
      failures.push({ name: p.name, query, reason: 'not found / service error' });
      console.log('❌ not found');
    } else {
      await prisma.project.update({
        where: { id: p.id },
        data: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          geocodedAt: new Date(),
          geocodeSource: 'nominatim',
          geocodedAddress: geo.formattedAddress,
        },
      });
      success++;
      console.log(`✓ ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`);
    }

    // Pace: 1.1s between requests. We still sleep on the last one to
    // keep the script polite if someone re-runs it rapidly.
    if (i < projects.length - 1) await sleep(1100);
  }

  console.log('\n--- Backfill complete ---');
  console.log(`✓ Geocoded: ${success}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⏭ Skipped:  ${skipped}`);
  if (failures.length > 0) {
    console.log('\nFailures (need manual address fix or pin):');
    for (const f of failures) {
      console.log(`  - ${f.name}: "${f.query}" — ${f.reason}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
