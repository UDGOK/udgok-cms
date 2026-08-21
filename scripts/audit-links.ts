/**
 * Comprehensive link audit.
 *
 * Walks every .tsx and .ts file in the project,
 * extracts every internal path that a user could end
 * up on (href=, formAction=, redirect(), Link href,
 * useRouter().push, revalidatePath, redirect()),
 * and verifies each one resolves to either:
 *
 *   1. A real page.tsx / route.ts in app/
 *   2. A documented public middleware route
 *      (e.g. /api/checkins/(.*) — no file, but
 *      deliberately allowed)
 *   3. An external URL / mailto: / tel:
 *   4. An anchor-only link (href="#...")
 *   5. A dynamic placeholder that we know is OK
 *      (e.g. /api/admin/diag-schema, /api/clients/...)
 *
 * Anything else is reported as a "broken" link.
 *
 * Run with: pnpm tsx scripts/audit-links.ts
 * Or:        npx tsx scripts/audit-links.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.home', 'dist', 'build', 'coverage', 'scripts']);

// Walk the app/ tree and collect every real route.
function buildRouteIndex() {
  const routes = new Set<string>();
  const apiRoutes = new Set<string>();
  const dynamicSegments = new Set<string>(); // [workspace], [id], etc.

  function urlForSegments(parts: string[]) {
    // Normalize Next.js dynamic segments:
    //   [[...rest]]  (optional catch-all) → just drop it
    //   [...rest]    (catch-all)          → keep
    //   [slug]       (dynamic)            → keep
    const norm = parts.filter((p) => !/^\[\[\.\.\..+\]\]$/.test(p));
    const path = '/' + norm.join('/');
    return path === '' ? '/' : path;
  }

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
      // Strip the (group) syntax from the path
      const rel = path.relative(path.join(ROOT, 'app'), full);
      const parts = rel.split(path.sep).map((p) => {
        if (/^\(.+\)$/.test(p)) return null; // route group
        if (p === 'page.tsx' || p === 'route.ts' || p === 'layout.tsx') return null;
        return p;
      }).filter((p): p is string => p != null);
      const url = urlForSegments(parts);
      if (rel.endsWith('route.ts')) {
        apiRoutes.add(url);
      } else if (rel.endsWith('page.tsx') || rel.endsWith('layout.tsx')) {
        routes.add(url);
      }
      // Collect dynamic segment names for fuzzy match
      for (const p of parts) {
        const m = p.match(/^\[(.+?)\]$/);
        if (m) dynamicSegments.add(m[1]);
        const mr = p.match(/^\[\.\.\.(.+?)\]$/);
        if (mr) dynamicSegments.add(mr[1]);
      }
    }
  }
  walk(path.join(ROOT, 'app'));
  return { routes, apiRoutes, dynamicSegments };
}

// Public middleware routes that don't have a corresponding
// app/ file but are intentionally allowed (because the route
// matcher in middleware.ts declares them public — e.g. API
// endpoints that have no page).
const MIDDLEWARE_PUBLIC_PATTERNS = [
  /^\/api\/checkins\/.*$/,
  /^\/api\/presence(\/.*)?$/,
  /^\/api\/cron\/.*$/,
  /^\/api\/webhooks\/.*$/,
  /^\/api\/p\/.*$/,
  /^\/api\/q\/.*$/,
  /^\/api\/pay-apps\/.*\/acknowledge$/,
  /^\/api\/files\/upload$/,
  /^\/api\/clients\/files$/,
  /^\/api\/debug\/blob-health$/,
  /^\/api\/subs\/.*\/documents$/,
  /^\/api\/projects\/.*\/bim$/,
  /^\/api\/projects\/.*\/photos\/upload$/,
];

// Known-external patterns the audit should ignore.
const EXTERNAL_PREFIXES = ['http://', 'https://', 'mailto:', 'tel:', '//'];

function isExternalOrAnchor(s: string) {
  const t = s.trim();
  if (!t) return true;
  if (t.startsWith('#')) return true;
  return EXTERNAL_PREFIXES.some((p) => t.startsWith(p));
}

function matchesMiddlewarePublic(s: string) {
  return MIDDLEWARE_PUBLIC_PATTERNS.some((re) => re.test(s));
}

interface AuditResult {
  href: string;
  file: string;
  line: number;
  category: 'broken' | 'dynamic-ok' | 'public-ok' | 'external' | 'placeholder';
  reason?: string;
}

// Extract internal paths from one file. This is a static-analysis
// pass — it doesn't execute the code. It handles:
//   - href="..."  (string literal)
//   - href={`/...`}  (template literal)
//   - href={`/...${var}/...`}  (interpolated template)
//   - redirect("/...")  (Next.js server redirect)
//   - redirect(\`/...\`)
//   - useRouter().push("/...")  (client navigation)
//   - revalidatePath is intentionally NOT audited — it's
//     server-side cache invalidation, not a user-visible
//     link, and partial paths like '/w' are valid there.
function extractFromFile(file: string): { href: string; line: number; context: string }[] {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const out: { href: string; line: number; context: string }[] = [];

  // Patterns to search. We use the literal regex on each line
  // and also a multi-line pass for template literals.
  const PATTERNS: { re: RegExp; kind: string }[] = [
    { re: /href\s*=\s*["']([^"']+)["']/g, kind: 'href-string' },
    { re: /href\s*=\s*\{\s*`([^`]+)`\s*\}/g, kind: 'href-template' },
    { re: /href\s*=\s*\{\s*["']([^"']+)["']\s*\}/g, kind: 'href-string' },
    { re: /\bredirect\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, kind: 'redirect-string' },
    { re: /\bredirect\s*\(\s*`([^`]+)`\s*\)/g, kind: 'redirect-template' },
    { re: /\buseRouter\(\)\.push\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, kind: 'router-push' },
    { re: /router\.push\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, kind: 'router-push' },
  ];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // Skip pure comment lines to avoid matching example syntax in JSDoc
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*\/\*/.test(line)) continue;
    for (const { re, kind } of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        out.push({
          href: m[1],
          line: li + 1,
          context: kind + ': ' + line.trim().slice(0, 120),
        });
      }
    }
  }
  return out;
}

// Resolve a path against the route index. Returns one of:
//   - 'broken' if the static path doesn't match any route
//   - 'dynamic-ok' if it contains an interpolation placeholder
//   - 'public-ok' if it matches a middleware public pattern
//   - 'external' if it's an external URL
function classifyPath(
  href: string,
  routes: Set<string>,
  apiRoutes: Set<string>,
): AuditResult['category'] {
  const t = href.trim();
  if (!t) return 'placeholder';
  if (isExternalOrAnchor(t)) return 'external';
  // Templates with ${...} placeholders are dynamic
  if (/\$\{[^}]+\}/.test(t)) return 'dynamic-ok';
  // Pure placeholder strings like 'dashboard' (without leading /)
  if (!t.startsWith('/')) return 'placeholder';
  // Strip query string and hash for matching
  const [purePath] = t.split(/[?#]/);
  // Check direct match
  if (routes.has(purePath) || apiRoutes.has(purePath)) return 'dynamic-ok';
  // Check with trailing slash
  if (routes.has(purePath + '/') || apiRoutes.has(purePath + '/')) return 'dynamic-ok';
  // Check middleware public patterns
  if (matchesMiddlewarePublic(purePath)) return 'public-ok';
  // Check wildcard / dynamic segments by trying to match a pattern
  // /w/foo/projects -> /w/[workspace]/projects
  const segments = purePath.split('/').filter(Boolean);
  let matched = false;
  for (const route of [...routes, ...apiRoutes]) {
    const routeSegs = route.split('/').filter(Boolean);
    if (routeSegs.length !== segments.length) continue;
    let ok = true;
    for (let i = 0; i < routeSegs.length; i++) {
      if (routeSegs[i].startsWith('[')) continue; // dynamic segment is fine
      if (routeSegs[i] !== segments[i]) { ok = false; break; }
    }
    if (ok) { matched = true; break; }
  }
  if (matched) return 'dynamic-ok';
  return 'broken';
}

function main() {
  const { routes, apiRoutes } = buildRouteIndex();
  console.log(`Indexed ${routes.size} page routes, ${apiRoutes.size} API routes.\n`);

  const results: AuditResult[] = [];
  const brokenByFile = new Map<string, AuditResult[]>();

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
      const hits = extractFromFile(full);
      for (const h of hits) {
        // Strip trailing template-literal expressions like /w/${ws.slug}/projects/${id}
        // by recording the raw text — the classify function handles it.
        const cat = classifyPath(h.href, routes, apiRoutes);
        if (cat === 'broken') {
          const r: AuditResult = {
            href: h.href,
            file: path.relative(ROOT, full),
            line: h.line,
            category: 'broken',
            reason: h.context,
          };
          results.push(r);
          if (!brokenByFile.has(r.file)) brokenByFile.set(r.file, []);
          brokenByFile.get(r.file)!.push(r);
        }
      }
    }
  }
  walk(ROOT);

  if (!results.length) {
    console.log('✅ No broken internal links found.');
    console.log(`   Scanned ${routes.size} routes across the app/ tree.`);
    return;
  }
  console.log(`❌ ${results.length} broken internal link(s) found:\n`);
  for (const [file, hits] of [...brokenByFile.entries()].sort()) {
    console.log(`  ${file}`);
    for (const h of hits) {
      console.log(`    ${h.file}:${h.line}  href=${h.href}`);
      console.log(`      ${h.reason}`);
    }
    console.log();
  }
  process.exitCode = 1;
}

main();
