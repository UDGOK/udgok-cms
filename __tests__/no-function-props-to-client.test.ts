/**
 * Regression test: no server-to-client function props.
 *
 * Background (Aug 2026): the lien-waivers page passed a `fmtUsd`
 * function as a prop to a 'use client' child component. React
 * can't serialize functions across the server/client boundary,
 * so the page threw "An error occurred in the Server Components
 * render" (React #419). The user saw a broken page in production.
 *
 * Fix pattern: shared utilities live in /lib/format/* so both
 * server and client components can `import` them instead of
 * receiving them as props. This test audits the four new
 * compliance pages to make sure no function props slipped in.
 *
 * The test is loose on purpose — it grep's for the common
 * pattern (page.tsx passing an inline function as a JSX prop
 * name) rather than AST-parsing, since the source patterns
 * vary and we want this to be fast + maintainable.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '..');

const PAGES_TO_AUDIT = [
  'app/(app)/w/[workspace]/projects/[id]/lien-waivers/page.tsx',
  'app/(app)/w/[workspace]/projects/[id]/change-orders/page.tsx',
  'app/(app)/w/[workspace]/projects/[id]/change-orders/[coId]/page.tsx',
  'app/(app)/w/[workspace]/projects/[id]/submittals/page.tsx',
  'app/(app)/w/[workspace]/projects/[id]/rfis/page.tsx',
];

// Heuristic: a function-as-prop looks like `<Component propName={() =>`
// or `<Component propName={function ...` or `<Component propName={fmtXxx}`
// where fmtXxx is a function name defined locally in the same file.
//
// We can't do full AST analysis in a unit test, so this is a
// "best-effort grep" — it will catch the common patterns that
// caused the lien-waivers bug, and might have false positives
// for legitimate use of arrow functions in JSX that aren't props
// (e.g. onClick handlers, which are fine because they're
// serialized as event listeners, not values).
//
// Heuristic 1: `={identifier}` where identifier matches
// "fmt*" — common name pattern for formatters. The function
// definitions of these are typically right above the JSX.

describe('Server pages do not pass function props to client components', () => {
  for (const relPath of PAGES_TO_AUDIT) {
    const abs = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(abs)) {
      it.skip(`${relPath} (not found, skipped)`, () => {});
      continue;
    }
    const src = fs.readFileSync(abs, 'utf8');

    it(`${relPath} does not pass fmt* functions as JSX props`, () => {
      // Look for JSX prop usages like `propName={fmtXxx}`. We
      // exclude `useState`/`useTransition` initializers (which
      // look like `useState(() => ...)`) by anchoring to JSX-ish
      // whitespace: 2+ spaces or newline before the prop name.
      const fmtPropPattern = /^\s{2,}[A-Za-z]+\s*=\s*\{fmt[A-Z][A-Za-z]*\}/m;
      const matches = src.match(/^[ \t]*[A-Za-z][A-Za-z0-9]*[ \t]*=[ \t]*\{fmt[A-Z][A-Za-z0-9]*\}/gm) ?? [];
      expect(
        matches,
        `Found ${matches.length} prop(s) passing a fmt* function across the server/client boundary in ${relPath}:\n${matches.join('\n')}\n` +
        `Move the function to /lib/format/* and import it in both server and client components.`,
      ).toHaveLength(0);
    });

    it(`${relPath} does not pass arrow functions as props to client children`, () => {
      // This catches inline arrow functions like `propName={() => ...}`
      // which is what the lien-waivers bug originally was.
      // The regex matches a JSX prop with an arrow body on the
      // same line — multiline arrows are fine but most common
      // formatters are single-line.
      const arrowPropPattern = /^\s{2,}[A-Za-z]+\s*=\s*\{\s*\([^)]*\)\s*=>/m;
      const matches = src.match(/^[ \t]*[A-Za-z][A-Za-z0-9]*[ \t]*=[ \t]*\{[ \t]*\([^)]*\)[ \t]*=>/gm) ?? [];
      // Allow event handlers which always end with `=>` and are
      // followed by `{` — those are legit. We only flag props
      // whose value is JUST an arrow function.
      const suspect = matches.filter((m) => !/on(Click|Change|Submit|Blur|Focus|KeyDown|KeyUp|Input|Paste)/.test(m));
      expect(
        suspect,
        `Found ${suspect.length} inline arrow-function prop(s) in ${relPath}:\n${suspect.join('\n')}\n` +
        `Inline arrow functions can't be serialized across the server/client boundary. ` +
        `Move the function to a shared module (/lib/format/*, /lib/utils/*) and import it.`,
      ).toHaveLength(0);
    });
  }
});
