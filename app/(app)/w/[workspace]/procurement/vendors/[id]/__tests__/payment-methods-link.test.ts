/**
 * Regression: the vendor detail page links to the per-vendor
 * payment methods page, and that page exists.
 *
 * Earlier the link didn't exist — buyers had to use the
 * workspace-wide /settings/payments page and find the
 * vendor in a long list. Now there's a direct link from
 * each vendor detail page.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const VENDOR_DETAIL = join(
  process.cwd(),
  'app/(app)/w/[workspace]/procurement/vendors/[id]/VendorDetailView.tsx',
);

const PM_PAGE = join(
  process.cwd(),
  'app/(app)/w/[workspace]/procurement/vendors/[id]/payment-methods/page.tsx',
);

describe('Per-vendor payment methods page', () => {
  it('page exists', () => {
    expect(existsSync(PM_PAGE)).toBe(true);
  });

  it('vendor detail page links to it', () => {
    const src = readFileSync(VENDOR_DETAIL, 'utf-8');
    expect(src).toContain('/payment-methods');
  });

  it('vendor detail page shows payment method summary', () => {
    const src = readFileSync(VENDOR_DETAIL, 'utf-8');
    expect(src).toContain('Payment methods on file');
  });
});
