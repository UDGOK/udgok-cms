import { PrismaClient } from '@prisma/client';

// Runtime env shim — Vercel's "smart prefix" renames env vars to
// UDGOK_CMS_*, but Prisma reads DATABASE_URL (unprefixed). next.config.mjs
// has the same shim, but that only runs at BUILD time, not at serverless
// function runtime. So we need to re-apply it here in code that runs
// on every cold start.
//
// This is the runtime equivalent of the next.config.mjs shim. They
// should stay in sync — if you add a new alias there, add it here too.

const envAliases: Record<string, string[]> = {
  DATABASE_URL: ['UDGOK_CMS_DATABASE_URL', 'UDGOK_CMS_POSTGRES_URL', 'UDGOK_CMS_POSTGRES_PRISMA_URL'],
};

for (const [target, sources] of Object.entries(envAliases)) {
  if (!process.env[target]) {
    for (const src of sources) {
      if (process.env[src]) {
        process.env[target] = process.env[src];
        break;
      }
    }
  }
}

// Prevent multiple Prisma Client instances in dev (HMR-safe).
// In production, this is a single instance.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
