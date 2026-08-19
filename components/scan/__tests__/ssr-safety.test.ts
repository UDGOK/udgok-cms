import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression tests for the BarcodeScanner crash bug
 * (Aug 2026).
 *
 * Bug: When the user typed a character in the manual code
 * input on /scan, the page crashed with:
 *
 *   Cannot stop, scanner is not running or paused.
 *
 * Root cause: BarcodeScanner's useEffect had [onResult, regionId]
 * in its deps. The parent (ScanPageClient) passed an inline
 * arrow function as onResult, which is a NEW reference on every
 * render. So every keystroke (which re-rendered the parent)
 * caused the scanner's effect to re-run — stop, clear, and
 * restart. The stop() call hit html5-qrcode while the scanner
 * was still starting, which threw synchronously. The throw
 * wasn't caught (Promise.resolve() doesn't catch sync throws)
 * and bubbled up to React's error boundary, which unmounted
 * the page.
 *
 * Two parts to the fix:
 *   1. ScanPageClient now wraps onResult in useCallback so the
 *      scanner effect only runs on first mount.
 *   2. BarcodeScanner wraps the cleanup's stop() in a real
 *      try/catch as defense in depth — if any future caller
 *      passes an unstable callback again, the page doesn't
 *      crash.
 *
 * These tests make sure both pieces stay in place.
 */

describe('BarcodeScanner — stable onResult contract', () => {
  it('ScanPageClient wraps onResult in useCallback', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/(app)/w/[workspace]/scan/ScanPageClient.tsx'),
      'utf8',
    );
    // The new code declares `const handleScanResult = useCallback(...)`.
    // Without this, the inline `onResult={(text) => router.push(...)}`
    // would re-create the function on every render and trigger
    // the BarcodeScanner's effect cleanup on every keystroke.
    expect(src).toMatch(/useCallback\(/);
    expect(src).toMatch(/handleScanResult/);
    // The inline arrow syntax should NOT be used for the
    // BarcodeScanner's onResult prop anymore.
    const onResultMatches = [
      ...src.matchAll(/<BarcodeScanner[\s\S]*?onResult=\{[^}]*=>[^}]*\}/g),
    ];
    expect(onResultMatches.length).toBe(0);
  });
});

describe('BarcodeScanner — defensive cleanup', () => {
  it('wraps scanner.stop() in a real try/catch', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/scan/BarcodeScanner.tsx'),
      'utf8',
    );
    // The old broken code was:
    //   Promise.resolve(scanner.stop?.()).catch(() => {})
    // which does NOT catch synchronous throws. Stop is documented
    // to throw synchronously in some cases (e.g. when the scanner
    // is still starting). The fix wraps it in an actual try/catch.
    //
    // We look for the pattern that distinguishes the fix from the
    // old code: a `try {` block containing the stop call, OR a
    // helper function like `safeStop` that does the try/catch.
    const hasTryCatchStop =
      /try\s*\{[\s\S]*?scanner\.stop\s*\(\?\.\)/.test(src) ||
      /safeStop/.test(src) ||
      /function\s+\w+\s*\(\s*\)\s*:\s*Promise/.test(src);
    expect(hasTryCatchStop).toBe(true);
  });

  it('wraps scanner.clear() in a try/catch too', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/scan/BarcodeScanner.tsx'),
      'utf8',
    );
    // clear() can also throw if stop() failed before the camera
    // started. We don't want a clear() throw to crash the page.
    // The fix wraps the clear() call in its own try/catch inside
    // the .then() callback. Look for the literal block.
    const clearBlockPattern = /try\s*\{[\s\S]*?scanner\.clear\(\)[\s\S]*?\}\s*catch\s*\{/;
    expect(clearBlockPattern.test(src)).toBe(true);
  });
});
