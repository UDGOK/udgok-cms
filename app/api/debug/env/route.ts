import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEYS = [
  'DATABASE_URL',
  'UDGOK_CMS_DATABASE_URL',
  'UDGOK_CMS_POSTGRES_URL',
  'UDGOK_CMS_POSTGRES_PRISMA_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'UDGOK_CMS_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'UDGOK_CMS_CLERK_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
  'UDGOK_CMS_APP_URL',
  'BLOB_READ_WRITE_TOKEN',
  'UDGOK_BLOB_READ_WRITE_TOKEN',
  'RESEND_API_KEY',
  'UDGOK_MESSAGING_RESEND_API_KEY',
];

export async function GET() {
  const status: Record<string, { set: boolean; preview: string }> = {};
  for (const k of KEYS) {
    const v = process.env[k];
    status[k] = {
      set: !!v,
      preview: v ? `${v.slice(0, 8)}...${v.slice(-4)} (${v.length} chars)` : 'NOT SET',
    };
  }
  return NextResponse.json({
    now: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL ? 'yes' : 'no',
    vercelRegion: process.env.VERCEL_REGION ?? null,
    env: status,
  });
}
