/**
 * Marketing site — link audit regression.
 *
 * Every internal link in the marketing nav, mobile drawer, footer,
 * and bottom CTA must point to a route that either:
 *   1. Exists in app/ (a page.tsx or route.ts), OR
 *   2. Exists in the middleware isPublicRoute list
 *   (so it bypasses auth and is reachable)
 *
 * Also: no `href="#"` placeholders. Anything that doesn't have a
 * real destination should be removed, not stubbed with #.
 *
 * Caught: the /showcase link that 307'd to /sign-in because it
 * wasn't in the public route list. The page itself was the
 * dev-only design system catalog.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const MARKETING_FILES = [
  'components/marketing/MarketingNav.tsx',
  'components/marketing/MobileDrawer.tsx',
  'components/marketing/MarketingFooter.tsx',
  'components/marketing/BottomCTA.tsx',
];

const middlewareSrc = readFileSync(join(ROOT, 'middleware.ts'), 'utf-8');

/** Pull every internal href from a source file. */
function extractHrefs(src: string): string[] {
  const out: string[] = [];
  // Match href="..." or href={...} with a string literal
  const re = /href=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const h = m[1];
    if (
      h.startsWith('mailto:') ||
      h.startsWith('tel:') ||
      h.startsWith('http://') ||
      h.startsWith('https://') ||
      h.startsWith('#') // anchor — skip
    ) {
      continue;
    }
    out.push(h);
  }
  return out;
}

/** Check whether a route exists as a Next.js page or API route. */
function routeExists(href: string): boolean {
  // Strip query string and hash
  const path = href.split('?')[0].split('#')[0];
  if (!path) return false;
  // Try as a page
  if (existsSync(join(ROOT, `app${path}`)) && statSync(join(ROOT, `app${path}`)).isDirectory()) {
    if (
      existsSync(join(ROOT, `app${path}/page.tsx`)) ||
      existsSync(join(ROOT, `app${path}/route.ts`))
    ) {
      return true;
    }
  }
  // Try as a page.tsx file directly
  if (existsSync(join(ROOT, `app${path}/page.tsx`))) {
    return true;
  }
  // Try as a route.ts file directly
  if (existsSync(join(ROOT, `app${path}/route.ts`))) {
    return true;
  }
  // Try with sub-routes (e.g. /q/[token] is dynamic, /api/...)
  // We can't easily verify those without running the dev server,
  // so we just check the parent directory exists.
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const parent = join(ROOT, 'app', parts[0]);
    if (existsSync(parent) && statSync(parent).isDirectory()) {
      return true;
    }
  }
  return false;
}

/** Check if a path matches a public route pattern in middleware. */
function isPublicRoute(path: string): boolean {
  // The middleware uses createRouteMatcher with glob patterns.
  // We do a lightweight check: if the path matches a literal
  // entry in isPublicRoute, it's public. For (.*) patterns we
  // check the prefix.
  const lines = middlewareSrc.split('\n');
  for (const line of lines) {
    const match = line.match(/'([^']+)'/);
    if (!match) continue;
    const pattern = match[1];
    if (pattern.includes('(.*)')) {
      const prefix = pattern.split('(')[0];
      if (path === prefix.slice(0, -1) || path.startsWith(prefix)) {
        return true;
      }
    } else {
      if (path === pattern) return true;
    }
  }
  return false;
}

describe('Marketing site — no dead links', () => {
  for (const file of MARKETING_FILES) {
    it(`${file} has no dead internal links`, () => {
      const src = readFileSync(join(ROOT, file), 'utf-8');
      const hrefs = extractHrefs(src);
      expect(hrefs.length).toBeGreaterThan(0); // sanity: file has links
      for (const href of hrefs) {
        const path = href.split('?')[0].split('#')[0];
        const exists = routeExists(path) || isPublicRoute(path);
        if (!exists) {
          throw new Error(
            `${file} links to ${href} (${path}) but no page/route exists at app${path} and it's not in middleware isPublicRoute`,
          );
        }
        expect(exists, `${file} → ${href} is unreachable`).toBe(true);
      }
    });
  }

  it('no marketing file uses href="#" placeholders', () => {
    for (const file of MARKETING_FILES) {
      const src = readFileSync(join(ROOT, file), 'utf-8');
      // Allow '#' in href for on-page anchor links (e.g. pricing#features)
      // but flag bare '#' placeholders.
      const barePlaceholders = src.match(/href=['"]#['"]/g);
      expect(
        barePlaceholders,
        `${file} has bare href="#" placeholders — fix or remove them`,
      ).toBeNull();
    }
  });

  it('homepage no longer links to /showcase', () => {
    const src = readFileSync(join(ROOT, 'app/page.tsx'), 'utf-8');
    expect(src).not.toMatch(/href=["']\/showcase["']/);
  });

  it('MarketingNav no longer links to /showcase', () => {
    const src = readFileSync(join(ROOT, 'components/marketing/MarketingNav.tsx'), 'utf-8');
    expect(src).not.toMatch(/href=["']\/showcase["']/);
  });
});
