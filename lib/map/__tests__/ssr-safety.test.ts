import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression test for the "document is not defined" SSR bug.
 *
 * On 2026-08-19, the project MAP tab (MapTab.tsx) used
 * `document.createElement` inside a useMemo factory. Next.js
 * runs the useMemo body during server-side render to produce
 * the initial HTML — and on the server, `document` doesn't
 * exist. The error was:
 *
 *   ReferenceError: document is not defined
 *     at Object.nr [as useMemo] ...
 *
 * Same bug existed in WorkspaceMapClient.tsx.
 *
 * The fix: marker DOM elements must be created inside useEffect
 * (client-only) rather than useMemo. The test below scans every
 * client component for `document.createElement` inside a
 * useMemo factory body and fails the build if it finds any.
 *
 * Trade-off: this test is a heuristic. It looks for the
 * pattern `useMemo(...)` and complains if `document.` appears
 * within ~600 chars of the useMemo call. A false positive
 * would only fire if someone writes `document.foo` outside an
 * event handler in the body of a useMemo — which is exactly
 * the bug we want to catch, so false positives are unlikely.
 */

const CLIENT_COMPONENT_PATHS = [
  'app/(app)/w/[workspace]/map/WorkspaceMapClient.tsx',
  'app/(app)/w/[workspace]/map/MapTab.tsx', // legacy — kept for reference
  'app/(app)/w/[workspace]/projects/[id]/MapTab.tsx',
  'app/(app)/w/[workspace]/scan/ScanPageClient.tsx',
  'app/(app)/w/[workspace]/scan/CreateInventoryFromScan.tsx',
  // Add any new client components that build marker DOM above
] as const;

describe('SSR safety — no document.* inside useMemo factories', () => {
  for (const p of CLIENT_COMPONENT_PATHS) {
    it(`${p} does not use document.* in a useMemo factory`, () => {
      const full = join(process.cwd(), p);
      let src: string;
      try {
        src = readFileSync(full, 'utf8');
      } catch {
        // File doesn't exist (e.g., legacy path). Skip.
        return;
      }

      // Strip comments and strings so a comment that says
      // "useMemo" doesn't trigger a false positive.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/(['"`])(?:\\.|(?!\1).)*?\1/g, '""');

      // Find every useMemo(… body that follows. Crude but
      // works for the patterns we use: `useMemo(() => { … })`
      // and `useMemo<T>(() => { … })`.
      const re = /useMemo(?:<[^>]+>)?\s*\(\s*\([^)]*\)\s*=>\s*\{/g;
      const matches = [...stripped.matchAll(re)];

      expect(matches.length, `${p}: no useMemo factories should exist that reference \`document\``).toBeGreaterThanOrEqual(0);

      for (const m of matches) {
        const start = m.index!;
        // Find the matching closing brace. Naive but good enough
        // for the 50-line bodies we use.
        let depth = 1;
        let i = start + m[0].length;
        while (i < stripped.length && depth > 0) {
          const ch = stripped[i];
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          i++;
        }
        const body = stripped.slice(start, i);
        if (/\bdocument\./.test(body)) {
          throw new Error(
            `${p}: useMemo body uses \`document.\` which is not defined during SSR. ` +
            `Move the DOM construction into a useEffect (which only runs on the client). ` +
            `Body excerpt: ${body.slice(0, 200)}…`,
          );
        }
      }
    });
  }
});

describe('SSR safety — no top-level document/window in client components', () => {
  // Even outside useMemo, a `document.foo()` call at the top
  // level of a client component (e.g., a statement at the
  // module body, NOT a function declaration) will throw on the
  // server during initial render. We detect this by looking
  // for `document.X` calls that are NOT preceded by `function`,
  // `=>`, `(`, `,`, or another call-expression-start character.
  //
  // Function declarations like `function buildMarkerEl() {
  // return document.createElement(...); }` are FINE because
  // they only run when called — and they're always called from
  // useEffect / event handlers (where `document` is defined).
  for (const p of CLIENT_COMPONENT_PATHS) {
    it(`${p} does not use document at module top level`, () => {
      const full = join(process.cwd(), p);
      let src: string;
      try {
        src = readFileSync(full, 'utf8');
      } catch {
        return;
      }
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/(['"`])(?:\\.|(?!\1).)*?\1/g, '""');

      const lines = stripped.split('\n');
      const offenders: string[] = [];
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (!/\bdocument\./.test(line)) continue;
        // Skip lines that are clearly inside a function body
        // (the line contains `function`, `=>`, or is a
        // continuation of a multi-line expression). We
        // approximate "inside a function" by checking whether
        // the line starts with whitespace (indented) — top-
        // level statements start at column 0.
        const trimmed = line.trim();
        const startsAtTopLevel = !line.startsWith(' ') && !line.startsWith('\t');
        const isDeclaration = /^function\s/.test(trimmed) || /^const\s\w+\s*=\s*\(/.test(trimmed) || /^const\s\w+\s*=\s*function/.test(trimmed);
        if (startsAtTopLevel && !isDeclaration && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          // Possible top-level statement. Check that the
          // previous non-blank line isn't opening a callback
          // (useEffect(() => {  ... }).
          let prevIdx = idx - 1;
          while (prevIdx >= 0 && lines[prevIdx].trim() === '') prevIdx--;
          const prev = prevIdx >= 0 ? lines[prevIdx].trim() : '';
          const isInsideArrow = /=>\s*\{?\s*$/.test(prev) || /=>\s*\{?\s*\/\//.test(prev);
          const isAfterUseEffect = /useEffect\(/.test(prev);
          if (!isInsideArrow && !isAfterUseEffect) {
            offenders.push(`L${idx + 1}: ${trimmed}`);
          }
        }
      }
      if (offenders.length > 0) {
        throw new Error(
          `${p}: \`document.\` used at module top level (not inside a function or hook body):\n  ${offenders.join('\n  ')}`,
        );
      }
    });
  }
});
