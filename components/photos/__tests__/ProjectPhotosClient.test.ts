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
 * NOTE: we only catch this for file inputs specifically. Duplicate
 * `name=` attributes on radio buttons are FINE (they form a radio
 * group). Duplicate `name=` on text/hidden inputs is at worst a
 * "last one wins" issue that callers can handle. File inputs are
 * the only case where the browser silently refuses to submit.
 */
describe('ProjectPhotosClient form', () => {
  it('has exactly one <input type="file" name="file"> (regression: PR a033643 added a duplicate)', () => {
    const file = join(process.cwd(), 'components/photos/ProjectPhotosClient.tsx');
    const src = readFileSync(file, 'utf8');
    // Find the PhotoUploadForm function body
    const start = src.indexOf('function PhotoUploadForm');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('\nfunction ', start + 1);
    const body = src.slice(start, end > -1 ? end : undefined);
    // Count <input type="file" ... name="file" /> inside the function body
    const fileInputs = body.match(/<input[^>]*type=["']file["'][^>]*name=["']file["']/g) ?? [];
    expect(fileInputs).toHaveLength(1);
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

  it('closes the bottom sheet via useEffect, not useState (regression: PR a033643 used useState which only runs once on mount)', () => {
    const file = join(process.cwd(), 'components/photos/ProjectPhotosClient.tsx');
    const src = readFileSync(file, 'utf8');
    // The upload-state-driven sheet close must be a useEffect. Catches
    // the bug where someone writes `useState(() => { if (ok) close() })`
    // — the lazy initializer runs only on mount when state is undefined.
    const closeSheetPattern = /use(State|Effect)\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?uploadState\?\.ok[\s\S]*?setSheetOpen\(false\)[\s\S]*?\}\s*\)/;
    const m = src.match(closeSheetPattern);
    expect(m, 'No uploadState.ok -> setSheetOpen(false) hook found').not.toBeNull();
    expect(m![1]).toBe('Effect');
  });
});
