'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeScanner, formatName } from '@/components/scan/BarcodeScanner';
import { Plan } from '@prisma/client';
import { FeatureGate } from '@/components/ui/UpgradePrompt';
import { RelativeTime } from '@/components/ui/RelativeTime';

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
  /**
   * Whether the camera viewport should start collapsed on
   * mobile. Set to `true` on the bare /scan URL when the
   * user is here to scan — camera is up immediately. Set
   * to `true` even on the result URL (?code= / ?hint=)
   * so the user can scan another code without re-mounting
   * the page. Defaults to false (collapsed) to keep the
   * page compact when shown from a "Scan again" link.
   */
  defaultCameraOpen?: boolean;
}

export function ScanPageClient({
  workspaceSlug,
  plan,
  isMasterAdmin,
  recentScans,
  defaultCameraOpen = true,
}: ScanPageClientProps) {
  const router = useRouter();
  const [cameraOpen, setCameraOpen] = useState(defaultCameraOpen);
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
  //
  // The format arg is the html5-qrcode format slug
  // ("qr_code", "ean_13", "code_128", etc.) — we forward it
  // in the URL so the result page can show what kind of code
  // was scanned ("📷 QR code", "📷 UPC", etc.).
  const handleScanResult = useCallback(
    (text: string, format: string) => {
      router.push(
        `/w/${workspaceSlug}/scan?code=${encodeURIComponent(text)}&format=${encodeURIComponent(format)}`,
      );
    },
    [router, workspaceSlug],
  );

  return (
    <FeatureGate plan={plan} feature="barcode_scan" isMasterAdmin={isMasterAdmin}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* ─── Camera viewport ──────────────────────────────────
            Previously this was a BottomSheet on mobile (locked
            body scroll, covered the result, no list visible).
            Now it's an inline card on every viewport, with a
            sticky variant on mobile so the camera stays
            visible while the user scrolls the rest of the
            page. The user can tap "Hide" to collapse the
            viewport and get more vertical space. */}
        <div className="md:relative md:z-auto sticky top-0 z-30 bg-cream md:bg-transparent -mx-4 md:mx-0 px-4 md:px-0 pt-2 md:pt-0 pb-3 md:pb-0">
          {cameraOpen ? (
            <div className="relative">
              <BarcodeScanner
                onResult={handleScanResult}
                showLastResult={false}
              />
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-paper border-2 border-ink text-ink-50 hover:text-ink"
                aria-label="Hide camera"
              >
                {/* ↓ arrow — collapse the camera down */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="w-full px-4 py-3 bg-ink text-paper text-[12px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange-d flex items-center justify-center gap-2"
            >
              📷 Open camera
            </button>
          )}
        </div>

        {/* ─── Manual code entry ───────────────────────────────── */}
        <div className="bg-paper border-2 border-ink p-4 md:p-6">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
            {'// Or type / paste a code'}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = manualCode.trim();
              if (!v) return;
              router.push(`/w/${workspaceSlug}/scan?code=${encodeURIComponent(v)}&format=manual`);
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

        {/* ─── Recent scans list ────────────────────────────────
            Was desktop-only because the mobile bottom sheet
            covered the whole viewport. Now that the camera is
            inline + collapsible, the list is visible on every
            viewport — this is the "what did each scan do"
            view the user asked for. The format slug from
            html5-qrcode is in the URL we redirected from; for
            a freshly-loaded page we don't have it on hand, so
            we show "code" as the fallback. */}
        <div className="bg-paper border-2 border-line p-4">
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
                <li
                  key={s.id}
                  className="py-2 flex items-start gap-2 text-[12px]"
                >
                  <span className="font-mono text-ink-70 break-all flex-1 min-w-0">
                    {s.code}
                  </span>
                  <span className="text-ink-50 shrink-0 text-[10px] uppercase tracking-[0.1em] flex flex-col items-end gap-0.5">
                    <span>
                      {s.source === 'camera' ? '📷 camera' : '⌨ manual'}
                    </span>
                    <span className="text-ink-30 normal-case tracking-normal">
                      <RelativeTime iso={s.createdAt} />
                    </span>
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
          <p className="mt-3 text-[10px] font-mono text-ink-50 leading-relaxed">
            Tip: scan QR codes AND 1D barcodes (UPC, EAN, CODE-128).
            The camera decodes whatever{'\u2019'}s in front of it
            {'—'}no need to switch modes.
          </p>
        </div>

        {/* ─── Try scanning hints ────────────────────────────── */}
        <div className="bg-paper border-2 border-line p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
            {'// Try scanning'}
          </div>
          <ul className="text-[12px] text-ink-70 space-y-1">
            <li>• A QR code on equipment (look up the asset)</li>
            <li>• A barcode on a material delivery (log the receipt)</li>
            <li>• A code on a subcontractor badge (jump to their profile)</li>
            <li>• A UPC on a material box (auto-catalog via product lookup)</li>
          </ul>
        </div>
      </div>
    </FeatureGate>
  );
}

// re-export so the page can use the formatter when showing
// the format slug from the URL on the result page.
export { formatName };
