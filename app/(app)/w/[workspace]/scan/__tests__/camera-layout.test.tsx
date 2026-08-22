// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/**
 * Regression tests for the redesigned scan page layout.
 *
 * Two user-reported issues this commit addresses:
 *
 *   1. "cant scroll on these pages to bottom" on the
 *      /scan mobile view. The previous design wrapped
 *      the BarcodeScanner in a BottomSheet that was
 *      modal-style (full-screen overlay + body scroll
 *      lock). On mobile the sheet covered ~85vh and
 *      locked the page scroll, so the user could see
 *      the camera but couldn't reach the rest of the
 *      page (recent scans, manual code entry, hints).
 *
 *      Fix: the camera is now an INLINE card on every
 *      viewport, with a sticky variant on mobile so it
 *      stays visible while the user scrolls the rest of
 *      the page. The user can collapse it via a ↓ button
 *      to get more vertical space. No body scroll lock
 *      anywhere on this page.
 *
 *   2. "i want it to scan QR codes also as well as
 *      regular bar codes and then populate what they
 *      all do in a list". html5-qrcode already supports
 *      both 2D and 1D codes; the missing piece was the
 *      list view, which was desktop-only because the
 *      mobile bottom sheet covered it. The list is now
 *      visible on every viewport.
 */

// Mock the BarcodeScanner — the test is about the page
// LAYOUT, not the camera. Real html5-qrcode needs DOM
// bits we don't have in jsdom.
vi.mock('@/components/scan/BarcodeScanner', () => ({
  BarcodeScanner: ({ onResult }: { onResult: (text: string, format: string) => void }) => (
    <div data-testid="barcode-scanner-mock">
      <button
        type="button"
        onClick={() => onResult('CM-2024-001', 'qr_code')}
      >
        simulate-scan
      </button>
    </div>
  ),
  formatName: (slug: string) => {
    const map: Record<string, string> = {
      qr_code: 'QR code',
      ean_13: 'EAN-13',
      code_128: 'CODE-128',
      manual: 'typed',
    };
    return map[slug] ?? slug;
  },
}));

vi.mock('react-dom', () => ({
  useFormStatus: () => ({ pending: false }),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}));

vi.mock('@/components/ui/UpgradePrompt', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ScanPageClient } from '../ScanPageClient';
import type { Plan } from '@prisma/client';

const baseRecentScans = [
  {
    id: 's1',
    code: 'CM-2024-001',
    source: 'camera',
    matched: 'project',
    matchedLabel: 'Smith Residence',
    createdAt: '2026-08-22T14:00:00Z',
  },
  {
    id: 's2',
    code: '0781234567890',
    source: 'camera',
    matched: null,
    matchedLabel: null,
    createdAt: '2026-08-22T13:55:00Z',
  },
];

beforeEach(() => {
  pushMock.mockReset();
  // No body scroll lock on this page (the previous
  // BottomSheet design set this; the new design must not).
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
});

describe('ScanPageClient — inline camera + list layout', () => {
  it('does NOT lock body scroll on mount (the bug was: body.style.overflow = hidden)', () => {
    // This is the core regression. The previous BottomSheet
    // design set `document.body.style.overflow = 'hidden'`
    // on mount, which is what made the user unable to scroll
    // the page. The new inline design must leave body scroll
    // untouched.
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={[]}
        defaultCameraOpen
      />,
    );
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders the camera and the recent-scans list on the SAME page (no separate sheet)', () => {
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        defaultCameraOpen
      />,
    );
    // The camera is present.
    expect(screen.getByTestId('barcode-scanner-mock')).toBeTruthy();
    // The recent scans list is present.
    expect(screen.getByText('CM-2024-001')).toBeTruthy();
    expect(screen.getByText('0781234567890')).toBeTruthy();
    // And the resolved entity from the first scan.
    expect(screen.getByText(/Smith Residence/)).toBeTruthy();
    // The second scan was a UPC that didn't match anything;
    // the row should say "not found" (or similar) so the
    // user knows the scanner DID capture it but the lookup
    // didn't resolve.
    expect(screen.getAllByText(/not found/i).length).toBeGreaterThan(0);
  });

  it('renders the recent-scans list on mobile (md:hidden removed in the redesign)', () => {
    // The previous design hid the list on mobile because
    // the BottomSheet covered the viewport. The new design
    // shows it on every viewport — we don't gate it with
    // `hidden md:block`. This test asserts the list is in
    // the DOM regardless of the media query (jsdom has no
    // real media query support, but the className check
    // catches a regression if someone re-adds the gate).
    const { container } = render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        defaultCameraOpen
      />,
    );
    // Find the list section. It should NOT be hidden on
    // mobile (no `hidden md:block` class).
    const list = screen.getByText('CM-2024-001').closest('ul');
    expect(list).toBeTruthy();
    // Walk up to the section card; the card must not carry
    // the old `hidden md:block` gate.
    const card = list!.closest('.bg-paper');
    expect(card?.className).not.toMatch(/hidden\s+md:block/);
    // (This is a defensive check; if a future change
    // re-gates the list, the test catches it.)
    void container;
  });

  it('the user can collapse the camera to make more room for the list', () => {
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        defaultCameraOpen
      />,
    );
    // Camera is open by default.
    expect(screen.getByTestId('barcode-scanner-mock')).toBeTruthy();
    // Tap the hide button (↓ arrow on the camera card).
    fireEvent.click(screen.getByRole('button', { name: /hide camera/i }));
    // Camera is gone; "Open camera" button is in its place.
    expect(screen.queryByTestId('barcode-scanner-mock')).toBeNull();
    expect(screen.getByRole('button', { name: /open camera/i })).toBeTruthy();
    // And the list is still on the page.
    expect(screen.getByText('CM-2024-001')).toBeTruthy();
  });

  it('passes the html5-qrcode format slug through to the URL on scan', () => {
    // The format is what lets the result page show
    // "QR code" vs "UPC-A" etc. The scanner mock calls
    // onResult with ('CM-2024-001', 'qr_code'). We
    // assert the redirect URL carries the format.
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={[]}
        defaultCameraOpen
      />,
    );
    fireEvent.click(screen.getByText('simulate-scan'));
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('format=qr_code'),
    );
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('code=CM-2024-001'),
    );
  });

  it('shows a hint that QR AND 1D barcodes are both supported', () => {
    // The user reported confusion about whether the
    // scanner handles barcodes. The redesigned page
    // includes a "Tip" line under the recent-scans
    // list that explicitly mentions QR + UPC + EAN +
    // CODE-128 so the foreman knows they don't have
    // to switch modes.
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        defaultCameraOpen
      />,
    );
    expect(screen.getByText(/QR codes AND 1D barcodes/i)).toBeTruthy();
  });
});
