'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeScanner } from '@/components/scan/BarcodeScanner';
import { Plan } from '@prisma/client';
import { FeatureGate } from '@/components/ui/UpgradePrompt';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface ScanPageClientProps {
  workspaceSlug: string;
  plan: Plan;
  isMasterAdmin: boolean;
}

export function ScanPageClient({ workspaceSlug, plan, isMasterAdmin }: ScanPageClientProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(true);

  return (
    <FeatureGate plan={plan} feature="barcode_scan" isMasterAdmin={isMasterAdmin}>
      <div className="md:hidden">
        <BottomSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            router.push(`/w/${workspaceSlug}`);
          }}
          title="Scan"
          maxHeightClass="max-h-[85vh]"
        >
          <BarcodeScanner
            onResult={(text) => {
              // After scan, look up the value in the workspace or pass it forward
              router.push(`/w/${workspaceSlug}/scan?code=${encodeURIComponent(text)}`);
            }}
            onClose={() => {
              setSheetOpen(false);
              router.push(`/w/${workspaceSlug}`);
            }}
          />
        </BottomSheet>
      </div>

      <div className="hidden md:block max-w-2xl mx-auto">
        <BarcodeScanner
          onResult={(text) => {
            router.push(`/w/${workspaceSlug}/scan?code=${encodeURIComponent(text)}`);
          }}
        />
      </div>

      {/* Recent scans hint */}
      <div className="mt-6 max-w-2xl mx-auto bg-paper border-2 border-line p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
          {'// Try scanning'}
        </div>
        <ul className="text-[12px] text-ink-70 space-y-1">
          <li>• A QR code on equipment (look up the asset)</li>
          <li>• A barcode on a material delivery (log the receipt)</li>
          <li>• A code on a subcontractor badge (jump to their profile)</li>
        </ul>
      </div>
    </FeatureGate>
  );
}
