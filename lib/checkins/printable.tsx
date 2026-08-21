'use client';

import { buildCheckInUrl, buildQrImageUrl } from './qr-urls';

export interface PrintableCode {
  id: string;
  label: string;
  token: string;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Print-friendly sheet of QR codes for one project.
 *
 * Renders one row per code: the QR image, the label,
 * the project name, and the token in tiny mono font
 * so the admin can read it off the page and hand-type
 * the URL if the camera ever fails to scan.
 *
 * The print stylesheet hides everything that isn't
 * the sheet, sets the page to landscape Letter, and
 * makes sure the orange palette survives printing
 * (browsers strip backgrounds by default).
 *
 * This is a server component — no client JS. The
 * print page can be opened with window.print() from
 * the parent page; the iframe trick isn't needed
 * because the entire view IS the print view.
 */
export function PrintableCheckInSheet({
  projectName,
  projectCode,
  codes,
  workspaceName,
}: {
  projectName: string;
  projectCode: string | null;
  codes: PrintableCode[];
  workspaceName: string;
}) {
  if (codes.length === 0) {
    return (
      <div className="p-8 text-center text-ink-50 font-mono uppercase text-[10px] tracking-[0.15em]">
        No check-in codes for this project yet
      </div>
    );
  }

  // Each QR row: ~3.5in tall × 4.5in wide. We fit 4 per
  // Letter-landscape page. The @page rule in the print
  // stylesheet sets the page size.
  return (
    <div>
      <style
        // Inline print stylesheet — kept inline so the
        // print view works even if globals.css hasn't
        // loaded yet (which happens when the user opens
        // this page in a new tab for the first time).
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: Letter landscape; margin: 0.4in; }
              body { background: white !important; }
              .no-print { display: none !important; }
              .sheet { padding: 0 !important; }
              .qr-row { break-inside: avoid; page-break-inside: avoid; border: 1px solid #1e2a3a !important; }
              .bg-orange { background-color: #f06a2d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .bg-ink { background-color: #1e2a3a !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .border-ink { border-color: #1e2a3a !important; }
            }
            @media screen {
              body { background: #f5f1ea; }
              .sheet { max-width: 11in; margin: 0 auto; padding: 24px; background: white; min-height: 8.5in; }
            }
          `,
        }}
      />

      {/* Screen-only header (hidden in print) */}
      <div className="no-print max-w-[11in] mx-auto mb-4 p-4 bg-paper border-2 border-ink">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
              {workspaceName}
            </div>
            <h1 className="text-2xl font-black">{projectName} — Check-in QRs</h1>
            <div className="text-[12px] text-ink-70 mt-1">
              Print this page and stick the QR codes at each
              check-in point. Cut along the row borders.
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-orange text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d border-2 border-orange"
          >
            Print this sheet
          </button>
        </div>
      </div>

      <div className="sheet">
        {/* Title row — also prints. Subtle so it doesn't
            distract from the QRs themselves. */}
        <div className="hidden print:flex items-baseline justify-between border-b-2 border-ink pb-2 mb-3">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-ink-50">
              {workspaceName} · {projectCode ?? 'PROJECT'}
            </div>
            <div className="font-black text-xl">{projectName}</div>
          </div>
          <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50">
            SITE CHECK-IN QR CODES
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3">
          {codes.map((c) => {
            const url = buildCheckInUrl(c.token);
            return (
              <div
                key={c.id}
                className="qr-row border-2 border-ink bg-white p-4 flex gap-4 items-center"
              >
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={buildQrImageUrl(url, 300)}
                    alt={`QR code for ${c.label}`}
                    width={140}
                    height={140}
                    className="block"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-ink-50">
                    SCAN TO CHECK IN
                  </div>
                  <div className="font-extrabold text-lg leading-tight mt-0.5 break-words">
                    {c.label}
                  </div>
                  <div className="text-[10px] text-ink-70 mt-1">
                    {projectName}
                  </div>
                  <div className="text-[8px] font-mono break-all text-ink-50 mt-2 leading-tight">
                    {url}
                  </div>
                  <div className="text-[8px] font-mono text-ink-50 mt-0.5">
                    ID: {c.token}
                  </div>
                  {!c.isActive ? (
                    <div className="mt-2 inline-block bg-ink text-cream text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5">
                      Retired
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
