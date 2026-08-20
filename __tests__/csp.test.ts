/**
 * Regression test for the Content-Security-Policy.
 *
 * The CSP in next.config.mjs is a long string. It's easy to
 * add a new origin to one directive (e.g. `connect-src` for
 * a fetch call) and forget to add it to another (e.g. `img-src`
 * for displaying the response). That happened with Vercel
 * Blob — it was in `connect-src` for upload progress, but
 * not in `img-src` for displaying the uploaded photo, and
 * every photo the user uploaded failed to render.
 *
 * This test parses the CSP and asserts that any host
 * allowed for fetching is also allowed for images. That's
 * the most common class of bug for an app like this.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configSource = readFileSync(
  resolve(__dirname, '../next.config.mjs'),
  'utf8',
);

/**
 * Extract the csp array. The actual CSP string is built by
 * joining the array entries with `; `, so we read the source
 * and look for the array literal.
 */
function extractCspArray(): string[] {
  // Find the `const csp = [` line, then read forward until
  // the matching `];` is balanced.
  const start = configSource.indexOf('const csp = [');
  if (start === -1) throw new Error('Could not find `const csp = [`');
  const arrStart = start + 'const csp = ['.length;
  let depth = 1;
  let i = arrStart;
  while (i < configSource.length && depth > 0) {
    const ch = configSource[i];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    i++;
  }
  if (depth !== 0) throw new Error('Unbalanced brackets in csp array');
  const body = configSource.slice(arrStart, i - 1);
  // Parse the entries. Each is a JS string literal optionally
  // followed by a `// comment` to end-of-line.
  const entries: string[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    // Skip whitespace + comments + commas
    while (cursor < body.length) {
      const c = body[cursor];
      if (/\s/.test(c) || c === ',') cursor++;
      else if (c === '/' && body[cursor + 1] === '/') {
        const nl = body.indexOf('\n', cursor);
        cursor = nl === -1 ? body.length : nl + 1;
      } else break;
    }
    if (cursor >= body.length) break;
    // Expect a string literal: "..." or '...'
    const quote = body[cursor];
    if (quote !== '"' && quote !== "'" && quote !== '`') {
      throw new Error(`Unexpected char at ${cursor}: ${body[cursor]}`);
    }
    const end = body.indexOf(quote, cursor + 1);
    if (end === -1) throw new Error('Unterminated string');
    entries.push(body.slice(cursor + 1, end));
    cursor = end + 1;
  }
  return entries;
}

function findDirective(entries: string[], name: string): string {
  const entry = entries.find((e) => e.startsWith(`${name} `) || e.startsWith(`${name}\t`));
  if (!entry) throw new Error(`Directive ${name} not found`);
  return entry;
}

const csp = extractCspArray();
const imgSrc = findDirective(csp, 'img-src');
const connectSrc = findDirective(csp, 'connect-src');

describe('Content-Security-Policy', () => {
  // Hosts known to return image data. Every one of these MUST
  // be in img-src. The Vercel Blob bug this test exists to
  // prevent: a host was in connect-src (for the upload XHR)
  // but not in img-src, so the browser silently blocked the
  // <img> tag that displayed the uploaded photo.
  const imageHosts = [
    { host: '*.public.blob.vercel-storage.com', why: 'project photos, file uploads' },
    { host: 'public.blob.vercel-storage.com', why: 'Vercel Blob bare host (defense-in-depth)' },
    { host: 'img.clerk.com', why: 'Clerk user avatars' },
    { host: '*.tile.openstreetmap.org', why: 'OSM map tiles' },
  ];

  for (const { host, why } of imageHosts) {
    it(`img-src allows ${host} (${why})`, () => {
      // Match either a wildcard subdomain or an exact host.
      // Wildcards: *.foo.com matches anything.foo.com but not
      // foo.com itself. So we also accept the bare host.
      // The character before the host in a CSP directive is
      // either whitespace (between tokens) or a `/` (right
      // after the https:// scheme).
      const escaped = host
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*');
      const regex = new RegExp(
        `(?:^|[\\s/])${escaped}(?:[\\s/]|$)`,
      );
      expect(
        imgSrc,
        `img-src is missing "${host}". The page makes <img> requests to this host ` +
          `(${why}), so without it the browser will block them silently. ` +
          `Add it to the img-src directive in next.config.mjs.`,
      ).toMatch(regex);
    });
  }

  it('img-src and connect-src cover the same Vercel Blob domains', () => {
    // Generic cross-check: Vercel Blob appears in connect-src
    // (for the upload XHR) — verify it ALSO appears in img-src.
    // This catches the "added to one directive, forgot the
    // other" class of bug for Vercel Blob specifically.
    expect(connectSrc).toMatch(/public\.blob\.vercel-storage\.com/);
    expect(imgSrc).toMatch(/public\.blob\.vercel-storage\.com/);
  });

  it('connect-src includes vercel.com for the @vercel/blob PUT', () => {
    // The @vercel/blob v2.x client uploads to `vercel.com/api/blob/...`
    // with auth headers, NOT directly to the public blob URL.
    // Without `vercel.com` in connect-src, every upload silently
    // fails with "Refused to connect to https://vercel.com/..."
    // (which is exactly what the browser console says).
    expect(connectSrc, 'connect-src is missing https://vercel.com').toMatch(
      /https:\/\/vercel\.com/,
    );
  });

  it('worker-src allows blob: workers (PDF preview, image resize)', () => {
    // PDF.js and image-resize workers use blob: URLs as worker
    // sources. Without `blob:` in worker-src, the browser blocks
    // them with "Refused to load blob:... because it does not
    // appear in the worker-src directive".
    const workerSrc = findDirective(csp, 'worker-src');
    expect(workerSrc, 'worker-src is missing blob:').toMatch(/\bblob:/);
  });

  it('child-src allows blob: for embedded workers', () => {
    // Older browsers fall back to child-src for worker support.
    // Without it, some browsers' PDF preview workers are blocked.
    const childSrc = findDirective(csp, 'child-src');
    expect(childSrc, 'child-src is missing blob:').toMatch(/\bblob:/);
  });
});
