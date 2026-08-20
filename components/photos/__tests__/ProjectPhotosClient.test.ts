import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression tests for bugs that have hit us in production.
 *
 * Bug (PR `a033643`): a duplicate `<input type="file" name="file">`
 * was added to PhotoUploadForm. Browser HTML5 validation refused to
 * submit because the second `required` file input was empty, so
 * iPhone photo uploads silently failed.
 *
 * After the direct-to-Vercel-Blob refactor (PR for the photos
 * progress fix), the form was renamed from `PhotoUploadForm` to
 * `PhotoUploadSheet` and now lives inside the BottomSheet on both
 * mobile and desktop. The test patterns below follow the new
 * function name; the "no duplicate file inputs" check still
 * searches the whole file regardless of function name.
 *
 * NOTE: we only catch this for file inputs specifically. Duplicate
 * `name=` attributes on radio buttons are FINE (they form a radio
 * group). Duplicate `name=` on text/hidden inputs is at worst a
 * "last one wins" issue that callers can handle. File inputs are
 * the only case where the browser silently refuses to submit.
 */
describe('ProjectPhotosClient form', () => {
  it('has exactly one <input type="file" name="file"> inside PhotoUploadSheet (regression: PR a033643 added a duplicate)', () => {
    const file = join(process.cwd(), 'components/photos/ProjectPhotosClient.tsx');
    const src = readFileSync(file, 'utf8');
    // Find the PhotoUploadSheet function body. The form was
    // renamed from PhotoUploadForm to PhotoUploadSheet when we
    // moved from a server action to direct browser→Vercel Blob
    // uploads. We search the whole file for the file input and
    // then count the ones with name="file" — that should be 1.
    const fileInputs =
      src.match(/<input[^>]*type=["']file["'][^>]*>/g) ?? [];
    const namedFileInputs = fileInputs.filter(
      (s) => /name=["']file["']/.test(s),
    );
    expect(namedFileInputs).toHaveLength(1);
  });

  it('has no duplicate file inputs across the whole file', () => {
    const file = join(process.cwd(), 'components/photos/ProjectPhotosClient.tsx');
    const src = readFileSync(file, 'utf8');
    // Every <input> that has type="file" must have a unique name=
    const fileInputs = src.match(/<input[^>]*type=["']file["'][^>]*>/g) ?? [];
    const names = fileInputs
      .map((s) => s.match(/name=["']([^"']+)["']/)?.[1])
      .filter((n): n is string => !!n);
    const counts = new Map<string, number>();
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
    const dups = Array.from(counts.entries()).filter(([, c]) => c > 1);
    expect(dups, `Duplicate file input name(s): ${JSON.stringify(dups)}`).toEqual([]);
  });

  it('uses the shared useBlobUpload hook for direct browser uploads (regression: server-action upload silently dropped 4.5MB+ files)', () => {
    // The original implementation called uploadProjectPhotoAction
    // which used server-side put() from @vercel/blob — that goes
    // through the 4.5MB function body limit. The fix: use the
    // shared useBlobUpload hook so the browser PUTs directly to
    // Vercel Blob, bypassing the function body cap. This test
    // pins that the import + the useBlobUpload call are present.
    const file = join(process.cwd(), 'components/photos/ProjectPhotosClient.tsx');
    const src = readFileSync(file, 'utf8');
    expect(src).toMatch(/from\s+['"]@\/lib\/blob\/client-upload['"]/);
    expect(src).toMatch(/useBlobUpload\s*\(/);
  });

  it('does not use the raw fetch upload pattern (regression: 4.5MB function body cap)', () => {
    // The wrong pattern: any `fetch('/api/...')` for upload.
    // We want the browser to go DIRECTLY to Vercel Blob via
    // the useBlobUpload hook. A raw fetch POST to the upload
    // endpoint puts the file body through the function payload
    // again, which is exactly the bug we're fixing.
    const file = join(process.cwd(), 'components/photos/ProjectPhotosClient.tsx');
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/fetch\(\s*['"`]\/api\/projects\/.*photos\/upload/);
  });
});
