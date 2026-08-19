'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeScanner } from '@/components/scan/BarcodeScanner';
import { Plan } from '@prisma/client';
import { FeatureGate } from '@/components/ui/UpgradePrompt';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface RecentScan {
  id: string;
  code: string;
  source: string;
  matched: string | null;
  matchedLabel: string | null;
  createdAt: string; // ISO string from server
}

interface ScanPageClientProps {
  workspaceSlug: string;
  plan: Plan;
  isMasterAdmin: boolean;
  recentScans: RecentScan[];
}

export function ScanPageClient({
  workspaceSlug,
  plan,
  isMasterAdmin,
  recentScans,
}: ScanPageClientProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(true);
  const [manualCode, setManualCode] = useState('');

  // Stable callbacks — IMPORTANT. The BarcodeScanner's useEffect
  // lists onResult in its deps array. If onResult is a fresh
  // arrow function on every render (which is what the inline
  // syntax in JSX produces), the effect re-runs on EVERY parent
  // render — including when the user types a character in the
  // manual code input below. The effect's cleanup calls
  // scanner.stop(), and html5-qrcode throws "Cannot stop,
  // scanner is not running or paused." if you try to stop a
  // scanner that hasn't finished starting. The unhandled throw
  // bubbles up to React's error boundary and unmounts the page.
  //
  // Wrapping in useCallback gives the callback a stable
  // reference, so the effect only re-runs when the workspace
  // actually changes (never, for the lifetime of this page).
  const handleScanResult = useCallback(
    (text: string) => {
      router.push(`/w/${workspaceSlug}/scan?code=${encodeURIComponent(text)}`);
    },
    [router, workspaceSlug],
  );
  const handleSheetClose = useCallback(() => {
    setSheetOpen(false);
    // /w/[workspaceSlug] (no subpath) is a 404 — there's no
    // top-level page for a workspace. Send the user to the
    // workspace dashboard instead.
    router.push(`/w/${workspaceSlug}/dashboard`);
  }, [router, workspaceSlug]);

  return (
    <FeatureGate plan={plan} feature="barcode_scan" isMasterAdmin={isMasterAdmin}>
      <div className="md:hidden">
        <BottomSheet
          open={sheetOpen}
          onClose={handleSheetClose}
          title="Scan"
          maxHeightClass="max-h-[85vh]"
        >
          <BarcodeScanner
            onResult={handleScanResult}
            onClose={handleSheetClose}
          />
        </BottomSheet>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Camera + manual input — the "two ways to look up" card */}
        <div className="hidden md:block bg-paper border-2 border-ink p-4 md:p-6">
          <BarcodeScanner
            onResult={handleScanResult}
          />

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = manualCode.trim();
              if (!v) return;
              router.push(`/w/${workspaceSlug}/scan?code=${encodeURIComponent(v)}`);
            }}
          >
            <label
              htmlFor="manual-scan-input"
              className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1"
            >
              Type or paste a code
            </label>
            <div className="flex gap-2">
              <input
                id="manual-scan-input"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. CM-2024-001, UPC-1234567890…"
                className="flex-1 px-3 py-2 border-2 border-ink bg-cream-2 text-[13px] font-mono focus:outline-none focus:bg-paper"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d transition-colors"
              >
                Look up →
              </button>
            </div>
            <p className="text-[10px] text-ink-50 mt-1">
              No camera or barcode in front of you? Paste a code, project ID,
              UPC, or even a name. The lookup searches your workspace the
              same way.
            </p>
          </form>
        </div>

        {/* Recent scans — visible only on desktop (mobile users get
         *  the bottom sheet which doesn't have room for a list).
         *  This is the audit trail: every scan is persisted so the
         *  user can see what they (or a teammate) scanned and when. */}
        <div className="hidden md:block bg-paper border-2 border-line p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
              {'// Recent scans'}
            </div>
            <div className="text-[10px] font-mono text-ink-50">
              {recentScans.length} most recent
            </div>
          </div>
          {recentScans.length === 0 ? (
            <p className="text-[12px] text-ink-50">
              No scans yet. Try scanning a code or use the text input above.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentScans.map((s) => (
                <li key={s.id} className="py-2 flex items-center gap-3 text-[12px]">
                  <span
                    className="font-mono text-ink-70 truncate flex-1 min-w-0"
                    title={s.code}
                  >
                    {s.code}
                  </span>
                  <span className="text-ink-50 shrink-0 text-[10px] uppercase tracking-[0.1em]">
                    {s.source === 'camera' ? '📷 camera' : '⌨ manual'}
                  </span>
                  <span className="text-ink-50 shrink-0 text-[10px]">
                    {timeAgo(new Date(s.createdAt))}
                  </span>
                  <span className="text-ink-70 shrink-0 max-w-[180px] truncate">
                    {s.matched && s.matchedLabel
                      ? `✓ ${s.matched}: ${s.matchedLabel}`
                      : s.matched
                      ? `✓ ${s.matched}`
                      : '— not found'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Try scanning hints — always visible */}
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
            {'// Try scanning'}
          </div>
          <ul className="text-[12px] text-ink-70 space-y-1">
            <li>• A QR code on equipment (look up the asset)</li>
            <li>• A barcode on a material delivery (log the receipt)</li>
            <li>• A code on a subcontractor badge (jump to their profile)</li>
          </ul>
        </div>
      </div>
    </FeatureGate>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
