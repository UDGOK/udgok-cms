/**
 * Blob storage health check.
 *
 * Returns 200 with the storage status so we can verify
 * the BLOB_READ_WRITE_TOKEN is alive without uploading a
 * real file. Hits Vercel Blob's list endpoint (a few KB,
 * no upload cost). Useful for debugging "uploads don't
 * work" reports without making the user try a 5MB file.
 *
 * NOTE: this endpoint is public (no auth) so we can ping
 * it from anywhere — the response only tells you "the
 * storeId is reachable + has at least N blobs", nothing
 * sensitive. If you need to lock this down, wrap the
 * handler in requireRole.
 */
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, reason: 'BLOB_READ_WRITE_TOKEN is not set in env' },
      { status: 503 },
    );
  }
  // Light-touch: list up to 1 blob. If the token is valid,
  // this resolves fast. If the token is revoked or the
  // store is suspended, Vercel returns 401/403.
  try {
    const res = await list({ limit: 1, token });
    return NextResponse.json({
      ok: true,
      storeId: extractStoreId(token),
      blobs: res.blobs.length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        reason: e instanceof Error ? e.message : 'unknown error',
        storeId: extractStoreId(token),
      },
      { status: 503 },
    );
  }
}

/** vercel_blob_rw_… token: storeId is the 3rd underscore-separated segment. */
function extractStoreId(token: string): string | null {
  const parts = token.split('_');
  if (parts.length < 4) return null;
  return parts[3] ?? null;
}
