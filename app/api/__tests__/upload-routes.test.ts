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

describe('Upload routes do not call auth() at the top of POST', () => {
  // handleUpload() dispatches the same POST route to EITHER:
  //   (a) the token-generation call from the browser (has the
  //       session cookie, so auth() works)
  //   (b) the upload-completion callback from Vercel's backend
  //       (server-to-server, NO user cookie, so auth() returns
  //       null and 401s the whole route)
  //
  // If auth() is at the top of the POST handler, the completion
  // callback is rejected with 401, onUploadCompleted never fires,
  // and the file lands in Vercel Blob with no DB row. Classic
  // 'uploaded but no row' symptom.
  //
  // The fix: auth + workspace/project lookups live INSIDE
  // onBeforeGenerateToken only. onUploadCompleted doesn't need
  // them — the userId is in the tokenPayload from the token step.
  //
  // These tests are static source checks because reproducing the
  // actual two-phase handleUpload call in vitest is hard. Better
  // to fail the test than the production upload.
  for (const p of UPLOAD_ROUTE_PATHS) {
    it(`${p} does not call auth() at the top of POST`, () => {
      const src = readFileSync(join(process.cwd(), p), 'utf8');
      // Look for the function signature line
      const postMatch = src.match(/export\s+async\s+function\s+POST\s*\([^)]*\)\s*\{/);
      expect(postMatch, `${p}: no POST handler found`).not.toBeNull();
      // Get the body up to the first onBeforeGenerateToken call
      // (that's the part that should NOT contain a top-level auth check).
      const afterPost = src.slice(postMatch!.index! + postMatch![0].length);
      const beforeOnBefore = afterPost.split(/onBeforeGenerateToken\s*:/)[0] ?? '';
      // The body before onBeforeGenerateToken should not call auth()
      // at the top level. Allow comments mentioning auth.
      const stripped = beforeOnBefore
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(
        /\bauth\s*\(\s*\)/.test(stripped),
        `${p}: top-level auth() call before onBeforeGenerateToken would 401 the Vercel upload-completion callback`,
      ).toBe(false);
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

describe('Middleware does not block handleUpload callback routes', () => {
  // handleUpload() dispatches the same URL to EITHER the browser
  // (has session cookie) OR Vercel's server-to-server upload-
  // completion callback (no cookie). Clerk middleware would
  // redirect the no-cookie callback to /sign-in with 307, so
  // onUploadCompleted never runs and the file is in Blob with no
  // DB row.
  //
  // The fix: every handleUpload route must be in `isPublicRoute` in
  // middleware.ts. The route itself does role-based auth inside
  // onBeforeGenerateToken, so it's safe to let the callback through.
  // (Found via the bd68574 deploy logs — POST /api/files/upload
  // returned 200 once for the token step, but the completion
  // callback never appeared in the logs. Root cause: Clerk
  // middleware redirected the callback.)
  it('middleware.ts lists all handleUpload routes as public', () => {
    const src = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
    // The createRouteMatcher array MUST include each upload route.
    for (const route of UPLOAD_ROUTE_PATHS) {
      // Convert the route path to the URL pattern the matcher
      // uses. e.g. "app/api/files/upload/route.ts" → "/api/files/upload"
      // and "app/api/subs/[id]/documents/route.ts" → "/api/subs/(.*)/documents"
      const urlPattern = route
        .replace(/^app/, '')
        .replace(/\/route\.ts$/, '')
        .replace(/\[id\]/g, '(.*)');
      expect(
        src.includes(`'${urlPattern}'`),
        `middleware.ts isPublicRoute must include '${urlPattern}' so the Vercel upload-completion callback isn't redirected to /sign-in`,
      ).toBe(true);
    }
  });
});
