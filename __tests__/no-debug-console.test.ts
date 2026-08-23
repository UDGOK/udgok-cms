/**
 * Regression test: no console.log in production source.
 *
 * Background: at one point we had 8 console.log calls scattered
 * across the upload routes and lib/blob/client-upload.ts. They
 * were happy-path breadcrumbs ("POST hit", "row created", etc.)
 * that didn't actually help debugging — the real error path was
 * already covered by console.error in the same files. They were
 * just noise. Stripped in the Aug 2026 refactor #3.
 *
 * Why this test exists: ESLint's `no-console` is off by default
 * (the team prefers `console.error`/`console.warn` in production
 * for Vercel log capture). That makes console.log easy to slip
 * in during a debug session and forget to remove. A grep-based
 * test catches the regression class.
 *
 * What's allowed:
 *   - console.error / console.warn — real error context for ops
 *   - lib/monitoring.ts — structured error logger (captureError/captureWarning)
 *   - tests themselves
 *   - The "no-console" eslint-disable comment indicates an
 *     intentional use; we still flag it, because intentional
 *     uses should be rare and reviewed in PRs.
 *
 * If a future console.log is genuinely needed (e.g. a verbose
 * debug flag for a specific issue), gate it behind an env var
 * or feature flag, or add an explicit `// allow-debug-log` comment
 * AND a comment block explaining why. Don't bypass the test by
 * disabling it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCAN_ROOTS = ['app', 'lib', 'components'] as const;
const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', 'dist', '.vercel']);

interface Violation {
  file: string;
  line: number;
  text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function findConsoleLogs(): Violation[] {
  const violations: Violation[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match console.log only (not .error, not .warn, not .info).
        // Allow the line if it has the opt-out marker so future
        // intentional uses are loud (a PR comment will be required).
        if (/console\.log\s*\(/.test(line) && !line.includes('// allow-debug-log')) {
          violations.push({
            file,
            line: i + 1,
            text: line.trim().slice(0, 120),
          });
        }
      }
    }
  }
  return violations;
}

describe('no-debug-console', () => {
  it('has zero console.log calls in production source', () => {
    const violations = findConsoleLogs();
    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line}\n    ${v.text}`)
        .join('\n');
      throw new Error(
        `Found ${violations.length} console.log call(s) in production source.\n` +
          `Use console.error/warn for ops, or add a structured logger.\n` +
          `If this is intentional, add the comment "// allow-debug-log" to the line.\n\n${msg}`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
