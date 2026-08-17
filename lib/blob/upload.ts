import { put, del } from '@vercel/blob';
import { nanoid } from 'nanoid';
import { env } from '@/lib/env';

/**
 * Upload a file to Vercel Blob under a logical prefix.
 * Returns the public URL and the storage pathname.
 */
export async function uploadFile(
  file: File | Blob,
  opts: {
    /** Logical prefix, e.g. "workspaces/{id}/clients" or "payapps/{id}". */
    prefix: string;
    /** Original filename, used to preserve extension and improve debugging. */
    filename?: string;
  },
): Promise<{ url: string; pathname: string; size: number; contentType: string }> {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set — configure Vercel Blob first');
  }

  const id = nanoid(12);
  const safeName = (opts.filename ?? 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `${opts.prefix}/${id}-${safeName}`;

  const result = await put(pathname, file, {
    access: 'public',
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: file instanceof File ? file.type : undefined,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    size: file.size,
    contentType: file instanceof File ? file.type : 'application/octet-stream',
  };
}

/**
 * Delete a blob by URL. Safe to call with a URL that no longer exists.
 */
export async function deleteFile(url: string): Promise<void> {
  if (!env.BLOB_READ_WRITE_TOKEN) return;
  await del(url, { token: env.BLOB_READ_WRITE_TOKEN }).catch(() => {
    // Best-effort delete; don't throw on missing.
  });
}
