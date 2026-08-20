/**
 * Mobile navigation — regression guard.
 *
 * The mobile drawer (MobileDrawer.tsx) has its own hardcoded
 * list of links because it predates the central nav/items.tsx
 * registry. We've already shipped a desktop sidebar with
 * Procurement in lib/nav/items.tsx, but Procurement was
 * missing from the mobile drawer — users on phones couldn't
 * see it.
 *
 * This test scans the source for a `/procurement` link entry
 * so a future "I removed this and forgot to add it back"
 * doesn't break the mobile UX again. Cheap, no jsdom needed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const drawerPath = join(process.cwd(), 'components/workspace/MobileDrawer.tsx');
const sidebarPath = join(process.cwd(), 'components/workspace/Sidebar.tsx');
const navItemsPath = join(process.cwd(), 'lib/nav/items.tsx');

describe('Mobile drawer — procurement link present', () => {
  it('MobileDrawer.tsx has a procurement link in its link list', () => {
    const src = readFileSync(drawerPath, 'utf-8');
    // Match a "Procurement" label + a /procurement href on
    // the same line. Both are required: the label alone
    // could be a comment, the href alone could be a fragment.
    const hasProcurementLink = /Procurement.*\/procurement/.test(src);
    expect(hasProcurementLink, 'MobileDrawer must include a "Procurement" link').toBe(true);
  });

  it('MobileDrawer.tsx has a procurement icon defined', () => {
    const src = readFileSync(drawerPath, 'utf-8');
    expect(src).toMatch(/ICON_PROCUREMENT/);
  });

  it('lib/nav/items.tsx has the canonical procurement nav item', () => {
    const src = readFileSync(navItemsPath, 'utf-8');
    expect(src).toMatch(/procurement/);
  });

  it('Sidebar.tsx renders the same nav as items.tsx (no hardcoded list)', () => {
    // Sanity check: the desktop sidebar sources from items.tsx,
    // not its own list. This is what we want — one source of
    // truth.
    const sidebarSrc = readFileSync(sidebarPath, 'utf-8');
    expect(sidebarSrc).toMatch(/import.*navItems.*from.*lib\/nav\/items/);
  });
});
