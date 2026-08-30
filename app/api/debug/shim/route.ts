import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Test if the env shim in next.config.mjs has run by checking
// process.env.DATABASE_URL right now (at request time, after
// the shim would have run at module load).
export async function GET() {
  return NextResponse.json({
    now: new Date().toISOString(),
    shimShouldHaveRun: true,
    shimRanOn: 'serverless function cold start',
    checks: {
      DATABASE_URL_set: !!process.env.DATABASE_URL,
      DATABASE_URL_preview: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.slice(0, 12)}...${process.env.DATABASE_URL.slice(-6)} (${process.env.DATABASE_URL.length} chars)` : 'NOT SET',
      UDGOK_CMS_DATABASE_URL_set: !!process.env.UDGOK_CMS_DATABASE_URL,
      UDGOK_CMS_DATABASE_URL_preview: process.env.UDGOK_CMS_DATABASE_URL ? `${process.env.UDGOK_CMS_DATABASE_URL.slice(0, 12)}...${process.env.UDGOK_CMS_DATABASE_URL.slice(-6)} (${process.env.UDGOK_CMS_DATABASE_URL.length} chars)` : 'NOT SET',
    },
    // If the shim is broken, the runtime would have these other
    // env vars that Prisma also reads. Check them too.
    otherDbVars: {
      POSTGRES_URL: process.env.POSTGRES_URL ? 'set' : 'NOT SET',
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? 'set' : 'NOT SET',
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? 'set' : 'NOT SET',
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ? 'set' : 'NOT SET',
    },
  });
}
