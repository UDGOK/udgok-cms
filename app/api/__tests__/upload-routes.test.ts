import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression tests for the "silent upload failure" bug class that
 * has bitten us twice:
 *
 *   - PR `a033643` (iPhone photo upload) — used a `fetch(...)` with
 *     `multipart/form-data` POST against a Next.js API route. The
 *     file body went through the Vercel function payload, which is
 *     capped at 4.5 MB. Anything larger got a 413 with no clear UI
 *     error, and the user saw "doing nothing".
 *
 *   - PR `b7bde87` → this PR (65 MB PDF) — same pattern, same bug.
 *     Three upload sites (workspace files, client files, sub docs)
 *     all POSTed to API routes which used the function body. The
 *     `onBeforeGenerateToken` handleUpload pattern is the right
 *     fix because it streams directly from the browser to Vercel
 *     Blob, bypassing the function body cap.
 *
 * These tests check the source so the same class of bug doesn't
 * get reintroduced — every upload route that handles a file MUST
 * use `handleUpload` (Vercel Blob client-side token flow), not the
 * raw `req.formData()` POST pattern.
 */

const UPLOAD_ROUTE_PATHS = [
  'app/api/files/upload/route.ts',
  'app/api/clients/files/route.ts',
  'app/api/subs/[id]/documents/route.ts',
  'app/api/projects/[id]/bim/route.ts',
] as const;

describe('Upload routes use handleUpload (no 4.5MB function body cap)', () => {
  for (const p of UPLOAD_ROUTE_PATHS) {
    it(`${p} uses @vercel/blob/client handleUpload`, () => {
      const src = readFileSync(join(process.cwd(), p), 'utf8');
      // The right import
      expect(src).toMatch(/from\s+['"]@vercel\/blob\/client['"]/);
      // The right call
      expect(src).toMatch(/handleUpload\s*\(/);
      // The wrong pattern — raw formData parse is the bug
      expect(src).not.toMatch(/req\.formData\(\)/);
      // We must not be using the server-side `put` either, because
      // the file would still flow through the function body.
      // (We import put in main.ts for the takeoff service, but the
      // upload routes themselves should rely on handleUpload.)
      expect(src).not.toMatch(/import\s+\{\s*put\s*\}\s+from\s+['"]@vercel\/blob['"]/);
    });
  }
});

describe('Upload components use the client-side upload hook', () => {
  const COMPONENT_PATHS = [
    'app/(app)/w/[workspace]/files/UploadForm.tsx',
    'app/(app)/w/[workspace]/clients/[id]/ClientFileUpload.tsx',
    'app/(app)/w/[workspace]/subcontractors/[id]/SubOnboardingScanner.tsx',
  ] as const;

  for (const p of COMPONENT_PATHS) {
    it(`${p} uses useBlobUpload (not raw fetch to /api)`, () => {
      const src = readFileSync(join(process.cwd(), p), 'utf8');
      // Must use the shared hook
      expect(src).toMatch(/useBlobUpload\s*\(/);
      // The broken pattern: raw fetch POST to the upload endpoint.
      // Any of these strings in the component means we're back to
      // the function-body upload path and 65MB files break again.
      expect(src).not.toMatch(/fetch\(\s*['"`]\/api\//);
    });
  }
});
