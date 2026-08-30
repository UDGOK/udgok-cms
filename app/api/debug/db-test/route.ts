import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

// Test the actual Prisma connection at runtime. If this
// endpoint returns ok:true, the DB is reachable. If it returns
// ok:false with an error, the error message is the real
// underlying cause of the masked "Server Components render"
// error on the marketing home page.

export async function GET() {
  // The env shim in next.config.mjs should have copied
  // UDGOK_CMS_DATABASE_URL -> DATABASE_URL at module load.
  // Verify that here.
  const dbUrl = process.env.DATABASE_URL;
  const udgokUrl = process.env.UDGOK_CMS_DATABASE_URL;

  const result: {
    ok: boolean;
    checks: {
      shimWorked: boolean;
      dbUrlPreview: string;
      udgokUrlPreview: string;
    };
    error?: {
      name: string;
      message: string;
      code?: string;
    };
    counts?: {
      users: number;
      workspaces: number;
      projects: number;
    };
  = {
    ok: false,
    checks: {
      shimWorked: !!dbUrl,
      dbUrlPreview: dbUrl ? `${dbUrl.slice(0, 12)}...${dbUrl.slice(-6)} (${dbUrl.length} chars)` : 'NOT SET',
      udgokUrlPreview: udgokUrl ? `${udgokUrl.slice(0, 12)}...${udgokUrl.slice(-6)} (${udgokUrl.length} chars)` : 'NOT SET',
    },
  };

  if (!dbUrl) {
    result.error = {
      name: 'MissingDatabaseUrl',
      message: 'DATABASE_URL is not set at runtime — the env shim did not copy UDGOK_CMS_DATABASE_URL. This means the runtime cannot connect to the database.',
    };
    return NextResponse.json(result, { status: 500 });
  }

  try {
    const [users, workspaces, projects] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.project.count(),
    ]);
    result.ok = true;
    result.counts = { users, workspaces, projects };
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error & { code?: string };
    result.error = {
      name: err.name,
      message: err.message,
      code: err.code,
    };
    return NextResponse.json(result, { status: 500 });
  }
}
