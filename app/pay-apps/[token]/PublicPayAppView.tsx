'use client';

import { useEffect, useState } from 'react';
import { recordPayAppView } from './actions';
import { Button, Field, Input } from '@/components/ui';

interface PublicPayAppViewProps {
  payApp: {
    id: string;
    drawNumber: number;
    periodStart: Date;
    periodEnd: Date;
    status: string;
    totalContract: number;
    totalPrevious: number;
    totalThisDraw: number;
    totalBalance: number;
    notes: string | null;
    project: {
      name: string;
      client: { name: string } | null;
    };
    divisions: Array<{
      id: string;
      previousAmount: number;
      thisDrawAmount: number;
      balanceAfter: number;
      projectDivision: { code: string; trade: string };
    }>;
  };
}

const formatMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// Print-only styles. When the user hits "Save as PDF" (or Ctrl+P), the browser
// prints only the document body — the top bar, acknowledge form, and footer
// are hidden so the PDF is a clean one-page pay app.
const printStyles = `
  @media print {
    @page { size: Letter; margin: 0.5in; }
    body { background: white !important; }
    .no-print { display: none !important; }
    .print-break-inside { break-inside: avoid; }
    .print-border { border: 2px solid #1e2a3a !important; }
    main { padding: 0 !important; max-width: none !important; }
    .bg-ink { background: #1e2a3a !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .text-cream { color: #f5f1ea !important; }
    .bg-cream-2 { background: #ede7d9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .bg-orange { background: #f06a2d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .text-orange { color: #f06a2d !important; }
    .text-orange-d { color: #d44a1a !important; }
    .text-orange-l { color: #ff8a5a !important; }
    .border-ink { border-color: #1e2a3a !important; }
  }
`;

export function PublicPayAppView({ payApp }: PublicPayAppViewProps) {
  const [email, setEmail] = useState('');
  const [recorded, setRecorded] = useState(false);
  const [ackState, setAckState] = useState<'idle' | 'submitting' | 'done'>('idle');

  useEffect(() => {
    if (!recorded) {
      recordPayAppView(payApp.id, null).then(() => setRecorded(true));
    }
  }, [payApp.id, recorded]);

  async function handleAck(e: React.FormEvent) {
    e.preventDefault();
    setAckState('submitting');
    try {
      await fetch(`/api/pay-apps/${payApp.id}/acknowledge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name: email }),
      });
    } catch {
      // ignore — best effort
    }
    setAckState('done');
  }

  function handleDownloadPdf() {
    // Trigger the browser's print dialog — user picks "Save as PDF" destination.
    window.print();
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Print-only CSS */}
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Top bar (hidden in print) */}
      <header className="no-print bg-ink text-cream px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-black text-2xl">
            UDG<span className="text-orange">OK</span>
          </span>
          <span className="font-mono text-[10px] tracking-[0.15em] text-cream/40 uppercase">
            Construction Management
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-[10px] tracking-[0.12em] text-cream/40 uppercase">
            Pay Application · #{payApp.drawNumber}
          </div>
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-orange text-paper font-extrabold uppercase tracking-[0.12em] text-[11px] hover:bg-orange-d transition-colors"
            title="Open the browser print dialog and choose 'Save as PDF'"
          >
            ↓ Download PDF
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1 bg-orange text-paper font-extrabold uppercase tracking-[0.15em] text-xs mb-4 no-print">
            Pay Application
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-2">{payApp.project.name}</h1>
          <p className="text-ink-50 text-base">
            {payApp.project.client?.name ?? '—'} · Period {formatDate(payApp.periodStart)} – {formatDate(payApp.periodEnd)}
          </p>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-ink bg-paper mb-8 print-border">
          <div className="p-6 border-r-2 border-b-2 md:border-b-0 border-ink last:border-b-0">
            <div className="label-mono">Total contract</div>
            <div className="font-black text-3xl">{formatMoney(payApp.totalContract)}</div>
          </div>
          <div className="p-6 border-r-2 border-b-2 md:border-b-0 border-ink last:border-b-0 bg-ink text-cream">
            <div className="label-mono text-cream/60">This draw</div>
            <div className="font-black text-4xl text-orange-l">{formatMoney(payApp.totalThisDraw)}</div>
          </div>
          <div className="p-6">
            <div className="label-mono">Balance to finish</div>
            <div className="font-black text-3xl">{formatMoney(payApp.totalBalance)}</div>
          </div>
        </div>

        {/* Lines */}
        <div className="bg-paper border-2 border-ink mb-8 print-border print-break-inside">
          <div className="px-6 py-4 bg-ink text-cream">
            <h2 className="font-extrabold uppercase tracking-[0.12em] text-sm">Schedule of values</h2>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Code', 'Description', 'Previously billed', 'This draw', 'Balance'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 bg-cream-2 border-b-2 border-ink text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payApp.divisions.map((line) => (
                <tr key={line.id}>
                  <td className="px-5 py-3 border-b border-line-soft font-mono text-[12px]">{line.projectDivision.code}</td>
                  <td className="px-5 py-3 border-b border-line-soft font-extrabold text-[14px]">{line.projectDivision.trade}</td>
                  <td className="px-5 py-3 border-b border-line-soft text-right font-extrabold">{formatMoney(line.previousAmount)}</td>
                  <td className="px-5 py-3 border-b border-line-soft text-right font-black text-orange-d">{formatMoney(line.thisDrawAmount)}</td>
                  <td className="px-5 py-3 border-b border-line-soft text-right font-extrabold">{formatMoney(line.balanceAfter)}</td>
                </tr>
              ))}
              <tr className="bg-cream-2">
                <td colSpan={2} className="px-5 py-3 font-extrabold uppercase text-[11px] tracking-[0.12em] border-t-2 border-ink">Totals</td>
                <td className="px-5 py-3 text-right font-extrabold text-lg border-t-2 border-ink">{formatMoney(payApp.totalPrevious)}</td>
                <td className="px-5 py-3 text-right font-black text-2xl text-orange-d border-t-2 border-ink">{formatMoney(payApp.totalThisDraw)}</td>
                <td className="px-5 py-3 text-right font-extrabold text-lg border-t-2 border-ink">{formatMoney(payApp.totalBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {payApp.notes ? (
          <div className="bg-paper border-2 border-ink p-6 mb-8 print-border print-break-inside">
            <h2 className="label-eyebrow mb-3">{'// Notes'}</h2>
            <p className="text-[14px] text-ink-70 whitespace-pre-wrap">{payApp.notes}</p>
          </div>
        ) : null}

        {/* Acknowledge (hidden in print) */}
        <div className="no-print bg-paper border-2 border-ink p-8 text-center">
          {ackState === 'done' ? (
            <div>
              <h2 className="text-2xl font-black mb-2">Acknowledged.</h2>
              <p className="text-ink-70">We&apos;ll confirm receipt and process the draw.</p>
            </div>
          ) : (
            <form onSubmit={handleAck} className="max-w-md mx-auto space-y-3">
              <h2 className="text-2xl font-black mb-2">
                Review and <span className="font-serif italic text-orange-d">acknowledge.</span>
              </h2>
              <p className="text-ink-70 text-sm mb-4">
                Enter your email to confirm you&apos;ve reviewed this pay application.
              </p>
              <Field label="Your email" htmlFor="ack-email">
                <Input
                  id="ack-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" variant="primary" size="lg" fullWidth disabled={ackState === 'submitting'}>
                {ackState === 'submitting' ? 'Submitting…' : 'Acknowledge pay app'}
              </Button>
            </form>
          )}
        </div>

        <p className="no-print text-center text-[11px] text-ink-50 mt-8">
          This is a private, secure pay application link. UDGOK Construction · Built with UDGOK CMS
        </p>
      </main>
    </div>
  );
}
