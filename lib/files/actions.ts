'use server';

// Workspace files are now uploaded via /api/files/upload (handleUpload
// token) which directly sends the file from the browser to Vercel Blob,
// bypassing the 4.5MB Vercel function body limit. This file is kept as
// a placeholder so any stale import doesn't break the build; the
// previous uploadFileAction is intentionally removed.
export {};
