import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static-source tests for ProjectTabs. The component imports
 * an icon registry keyed by tab key, and the project page
 * declares tabs in the same key shape. If someone adds a tab
 * key to the page but forgets to register an icon, this test
 * catches it.
 *
 * We use static-source analysis instead of a runtime test
 * because the icon registry is intentionally a private
 * constant inside the component (the page-side tab config
 * stays a flat list of { key, label, href, badge? }).
 */

const TABS_TSX = readFileSync(
  join(process.cwd(), 'app/(app)/w/[workspace]/projects/[id]/ProjectTabs.tsx'),
  'utf8',
);
const PROJECT_PAGE_TSX = readFileSync(
  join(process.cwd(), 'app/(app)/w/[workspace]/projects/[id]/page.tsx'),
  'utf8',
);

describe('ProjectTabs — icon registry coverage', () => {
  // 1. Extract every key in the TAB_ICONS registry. Keys can
  // be either unquoted (overview, photos) or quoted ('pay-apps')
  // because 'pay-apps' has a hyphen and JS object keys with
  // hyphens must be string literals.
  const iconKeys = Array.from(
    TABS_TSX.matchAll(/^\s{2}(?:'([a-z][a-z0-9-]*)'|([a-z][a-z0-9-]*)):\s*\(/gm),
  ).map((m) => m[1] || m[2]);

  it('TAB_ICONS has at least 10 entries (covers the main project sections)', () => {
    expect(iconKeys.length).toBeGreaterThanOrEqual(10);
  });

  // 2. Extract every key passed in the page's tabs array.
  const pageTabKeys = Array.from(
    PROJECT_PAGE_TSX.matchAll(/key:\s*'([a-z][a-z0-9-]*)'/g),
  ).map((m) => m[1]);
  // Filter to the project tabs section only (skip any other
  // "key:" strings in the file that aren't tab keys).
  // We approximate by ensuring all page tab keys are present in
  // the icon registry.
  const uniquePageKeys = Array.from(new Set(pageTabKeys));

  it.each(uniquePageKeys)('page tab "%s" has an icon registered', (key) => {
    expect(iconKeys, `missing icon in TAB_ICONS for tab key "${key}"`).toContain(key);
  });
});

describe('ProjectTabs — accessibility / a11y basics', () => {
  it('wraps the nav in a <nav> with an aria-label', () => {
    // We don't want a generic <div> here — assistive tech
    // benefits from the landmark + a label that distinguishes
    // this nav from the workspace sidebar.
    expect(TABS_TSX).toMatch(/<nav[^>]*aria-label=/);
  });

  it('sets aria-current="page" on the active tab', () => {
    expect(TABS_TSX).toMatch(/aria-current/);
  });

  it('marks all icons aria-hidden (they are decorative; the label carries the meaning)', () => {
    // Heroicons-style SVGs should have aria-hidden="true" so
    // screen readers don't read out "image" or similar.
    const svgCount = (TABS_TSX.match(/<svg/g) || []).length;
    const ariaHiddenCount = (TABS_TSX.match(/aria-hidden="true"/g) || []).length;
    expect(ariaHiddenCount).toBe(svgCount);
  });
});

describe('ProjectTabs — mobile overflow handling', () => {
  it('enables horizontal scroll on the nav container', () => {
    expect(TABS_TSX).toMatch(/overflow-x-auto/);
  });

  it('hides the scrollbar (we want snap, not a visible scrollbar)', () => {
    expect(TABS_TSX).toMatch(/scrollbar-hide/);
  });

  it('uses scroll-snap for tab stops', () => {
    expect(TABS_TSX).toMatch(/scroll-snap/);
  });
});
