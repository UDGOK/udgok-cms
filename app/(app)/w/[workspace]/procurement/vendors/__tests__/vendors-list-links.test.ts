/**
 * VendorsList — relative link regression guard.
 *
 * The VendorsList used to render vendor detail links as
 * `href={\`./${v.id}\`}` (relative), which from
 * /w/<slug>/procurement/vendors resolves to
 * /w/<slug>/procurement/<id> — wrong path, 404.
 *
 * Same bug pattern as the materials list fix in commit
 * 11c797b. This test scans the source to ensure no
 * relative `./` or `../` hrefs remain in the VendorsList
 * component, and that the absolute /procurement/vendors/
 * path is used.
 *
 * Cheap, no jsdom needed — read + regex, ~1ms.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const vendorsListPath = join(
  process.cwd(),
  'app/(app)/w/[workspace]/procurement/vendors/VendorsList.tsx',
);

describe('VendorsList — link patterns', () => {
  it('does not use relative `href=./...` links (404 bug)', () => {
    const src = readFileSync(vendorsListPath, 'utf-8');
    // Look for any href value that starts with ./ or ../
    // (the patterns that caused the bug).
    const hasRelative = /href\s*=\s*[`'"]\.\.?\//.test(src);
    expect(
      hasRelative,
      'VendorsList must not use relative ./ or ../ hrefs — they resolve wrong under Next dynamic routes',
    ).toBe(false);
  });

  it('uses absolute /procurement/vendors/${id} links', () => {
    const src = readFileSync(vendorsListPath, 'utf-8');
    expect(src).toMatch(/\/procurement\/vendors\/\$\{/);
  });

  it('takes a workspaceSlug prop (so the link can be absolute)', () => {
    const src = readFileSync(vendorsListPath, 'utf-8');
    expect(src).toMatch(/workspaceSlug:\s*string/);
  });
});
