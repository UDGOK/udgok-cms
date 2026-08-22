// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/**
 * Regression test: "cant scroll on these pages to bottom" on
 * /w/[ws]/scan?code=... and /w/[ws]/scan?hint=... URLs.
 *
 * The mobile scanner sheet (BottomSheet) was opening on
 * initial render of ScanPageClient regardless of the URL.
 * This:
 *   1. Covered ~85vh of the viewport with the sheet, hiding
 *      the page content below the result card.
 *   2. Locked document.body.style.overflow = 'hidden', so
 *      even the visible portion of the page couldn't be
 *      scrolled to the bottom.
 *
 * The user's "cant scroll" was both — the sheet was hiding
 * the bottom AND the body scroll was locked.
 *
 * Fix: ScanPageClient now takes an `initialSheetOpen` prop
 * driven by the URL. The page passes `false` when the URL
 * has `?code=...` or `?hint=...` (the user is past the
 * scan, looking at the result), and `true` for the bare
 * /scan URL (the user is here to scan).
 *
 * To bring the sheet back on mobile, a "📷 Scan another
 * code" button is rendered at the bottom of the page when
 * the sheet is closed. Tapping it re-opens the sheet.
 */

// Mock the BarcodeScanner so we don't try to start a real
// html5-qrcode instance in jsdom. The test is about the
// SCROLL behavior, not the camera.
vi.mock('@/components/scan/BarcodeScanner', () => ({
  BarcodeScanner: () => <div data-testid="barcode-scanner-mock" />,
}));

vi.mock('react-dom', () => ({
  useFormStatus: () => ({ pending: false }),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}));

// Gate the page behind a Pro plan check.
vi.mock('@/components/ui/UpgradePrompt', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ScanPageClient } from '../ScanPageClient';
import type { Plan } from '@prisma/client';

const baseRecentScans: never[] = [];

beforeEach(() => {
  pushMock.mockReset();
  // Reset body styles between tests — the BottomSheet's
  // scroll-lock effect mutates document.body and could
  // leak across cases.
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
});

describe('ScanPageClient — initialSheetOpen', () => {
  it('opens the mobile scanner sheet by default on the bare /scan page', () => {
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        initialSheetOpen
      />,
    );
    // The bottom sheet renders a role="dialog" with
    // aria-modal="true" (see BottomSheet.tsx). The
    // presence of that dialog means the sheet is open.
    expect(screen.getByRole('dialog')).toBeTruthy();
    // And the body scroll is locked — this is the
    // mechanism that prevented the user from scrolling
    // to the bottom of the page. We only assert this
    // for the open case (the closed case is the
    // "fixed" path).
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('does NOT open the sheet on /scan?code=... (user has already scanned)', () => {
    // This is the user's reported bug. The fix: when
    // there's already a code in the URL, the page is
    // showing the scan result, not prompting for a new
    // scan. The sheet should be closed so the user can
    // scroll the result + form.
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        initialSheetOpen={false}
      />,
    );
    // No dialog means the sheet is closed.
    expect(screen.queryByRole('dialog')).toBeNull();
    // And the body scroll is NOT locked — the user can
    // scroll the page to the bottom.
    expect(document.body.style.overflow).not.toBe('hidden');
    // The mobile "Scan another" button should be visible
    // so the user has a path back to the camera.
    expect(screen.getByRole('button', { name: /scan another code/i })).toBeTruthy();
  });

  it('does NOT open the sheet on /scan?hint=material&projectId=... (create-inventory deep link)', () => {
    // The second URL the user reported. They're filling
    // out an inventory form, not scanning. Same fix:
    // closed by default, mobile "Scan another" available.
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        initialSheetOpen={false}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(screen.getByRole('button', { name: /scan another code/i })).toBeTruthy();
  });

  it('re-opens the sheet when the user taps "Scan another code"', () => {
    // Closed -> open transition. The button's purpose is
    // to give the user a way to come back to the camera
    // after reading the result.
    render(
      <ScanPageClient
        workspaceSlug="udgok"
        plan={'PRO' satisfies Plan}
        isMasterAdmin
        recentScans={baseRecentScans}
        initialSheetOpen={false}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /scan another code/i }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
  });
});
