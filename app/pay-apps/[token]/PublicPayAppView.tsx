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
      code: string | null;
      client: { name: string } | null;
    };
    // For the project completion bar
    allDraws: Array<{
      drawNumber: number;
      totalThisDraw: number;
    }>;
    divisions: Array<{
      id: string;
      previousAmount: number;
      thisDrawAmount: number;
      balanceAfter: number;
      budget: number; // computed below
      projectDivision: {
        code: string;
        trade: string;
        subcontractorName: string | null;
        // Resolved at fetch time: the linked sub's name (priority over the free-text field)
        linkedSubName: string | null;
      };
    }>;
  };
}

const formatMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

const formatDateShort = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

// Print-only styles — preserves UDGOK palette when the user prints to PDF.
const printStyles = `
  @media print {
    @page { size: Letter; margin: 0.5in; }
    body { background: white !important; }
    .no-print { display: none !important; }
    .print-break-inside { break-inside: avoid; }
    .bg-ink { background: #1e2a3a !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
    window.print();
  }

  // Overall project completion — by contract value drawn
  const totalDrawn = payApp.allDraws.reduce((acc, d) => acc + Number(d.totalThisDraw), 0);
  const completionPct = payApp.totalContract > 0
    ? Math.min(100, Math.round((totalDrawn / Number(payApp.totalContract)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-cream-2">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Top bar (hidden in print) */}
      <header className="no-print bg-ink text-cream px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-black text-2xl">UDG<span className="text-orange">OK</span></span>
          <span className="font-mono text-[10px] tracking-[0.15em] text-cream/40 uppercase">Construction Management</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] tracking-[0.12em] text-cream/40 uppercase">Pay Application · #{payApp.drawNumber}</span>
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-orange text-paper font-extrabold uppercase tracking-[0.12em] text-[11px] hover:bg-orange-d transition-colors"
            title="Open the browser print dialog and choose 'Save as PDF'"
          >
            ↓ Download PDF
          </button>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto p-6 md:p-8 print:p-0">
        {/* Document header */}
        <div className="bg-ink text-cream px-8 py-7 flex items-start justify-between border-b-[6px] border-orange">
          <div>
            <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-cream/50 mb-2">
              PROGRESS DRAW REQUEST · APPLICATION FOR PAYMENT
            </div>
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-cream/70 mt-3">
              {payApp.project.code ?? 'PROJECT'} · {payApp.project.client?.name?.toUpperCase() ?? 'NO CLIENT'} · {payApp.project.name.toUpperCase()}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-cream/50">DRAW</div>
            <div className="font-black text-6xl leading-none text-orange-l">No.{payApp.drawNumber}</div>
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-cream/70 mt-2">
              PERIOD: {formatDateShort(payApp.periodStart)} – {formatDateShort(payApp.periodEnd)}
            </div>
          </div>
        </div>

        {/* 4-cell headline numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-b-2 border-ink bg-paper">
          <div className="p-5 md:p-6 border-r-2 border-ink">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50 font-extrabold">Total Contract</div>
            <div className="font-black text-2xl md:text-3xl mt-1.5">{formatMoney(payApp.totalContract)}</div>
          </div>
          <div className="p-5 md:p-6 border-r-2 border-ink">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50 font-extrabold">Previous Draws</div>
            <div className="font-black text-2xl md:text-3xl mt-1.5">{formatMoney(payApp.totalPrevious)}</div>
          </div>
          <div className="p-5 md:p-6 border-r-2 border-ink bg-cream-2">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50 font-extrabold">Requested this Draw</div>
            <div className="font-black text-2xl md:text-3xl mt-1.5 text-orange-d">{formatMoney(payApp.totalThisDraw)}</div>
          </div>
          <div className="p-5 md:p-6">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50 font-extrabold">Balance to Finish</div>
            <div className="font-black text-2xl md:text-3xl mt-1.5">{formatMoney(payApp.totalBalance)}</div>
          </div>
        </div>

        {/* Project completion bar */}
        <div className="bg-paper border-b-2 border-ink px-6 py-5 print-break-inside">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50 font-extrabold">
              Overall Project Completion — by Contract Value Drawn
            </div>
            <div className="font-black text-2xl text-orange-d">{completionPct}%</div>
          </div>
          <div className="relative h-2 bg-cream-2">
            <div
              className="absolute left-0 top-0 h-full bg-orange"
              style={{ width: `${completionPct}%` }}
            />
            {/* Draw markers */}
            {payApp.allDraws.map((d) => {
              const cumBefore = payApp.allDraws
                .filter((x) => x.drawNumber < d.drawNumber)
                .reduce((acc, x) => acc + Number(x.totalThisDraw), 0);
              const left = payApp.totalContract > 0
                ? Math.min(100, (cumBefore / Number(payApp.totalContract)) * 100)
                : 0;
              return (
                <div
                  key={d.drawNumber}
                  className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-ink"
                  style={{ left: `${left}%` }}
                  title={`Draw ${d.drawNumber}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {payApp.allDraws.map((d) => (
              <span key={d.drawNumber}>
                DRAW {d.drawNumber} · {payApp.totalContract > 0
                  ? Math.round((payApp.allDraws.filter((x) => x.drawNumber <= d.drawNumber).reduce((acc, x) => acc + Number(x.totalThisDraw), 0) / Number(payApp.totalContract)) * 100)
                  : 0}%
              </span>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div className="bg-paper print-break-inside">
          {/* Header row */}
          <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_1.4fr] gap-3 px-5 py-3 bg-cream-2 border-b-2 border-ink text-[9px] font-mono font-extrabold uppercase tracking-[0.15em] text-ink-50">
            <div>Division / Trade / Subcontractor</div>
            <div className="text-right">Budget</div>
            <div className="text-right">Previous</div>
            <div className="text-right">This Draw</div>
            <div className="text-right">Balance</div>
            <div className="text-right">% to Date</div>
          </div>

          {/* Rows */}
          {payApp.divisions.map((line) => {
            const budget = line.budget;
            const pctToDate = budget > 0
              ? Math.round(((Number(line.previousAmount) + Number(line.thisDrawAmount)) / budget) * 100)
              : 0;
            const subName = line.projectDivision.linkedSubName || line.projectDivision.subcontractorName;
            return (
              <div
                key={line.id}
                className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_1.4fr] gap-3 px-5 py-4 border-b border-line-soft last:border-0 items-center hover:bg-cream-2/50"
              >
                {/* Division / Trade / Sub */}
                <div>
                  <div className="inline-block bg-ink text-cream px-2 py-0.5 text-[10px] font-mono font-extrabold tracking-[0.05em] mb-1.5">
                    DIV {line.projectDivision.code}
                  </div>
                  <div className="font-extrabold text-[14px] leading-tight">{line.projectDivision.trade}</div>
                  {subName ? (
                    <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d font-extrabold mt-1">
                      {subName}
                    </div>
                  ) : null}
                </div>

                {/* Budget */}
                <div className="text-right font-extrabold text-[14px]">{formatMoney(budget)}</div>

                {/* Previous */}
                <div className="text-right font-extrabold text-[14px]">{formatMoney(line.previousAmount)}</div>

                {/* This Draw */}
                <div className="text-right font-black text-[15px] text-orange-d">
                  {formatMoney(line.thisDrawAmount)}
                </div>

                {/* Balance */}
                <div className="text-right font-extrabold text-[14px]">{formatMoney(line.balanceAfter)}</div>

                {/* % to date with bar */}
                <div>
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex-1 h-1.5 bg-cream-2 max-w-[120px]">
                      <div
                        className="h-full bg-orange"
                        style={{ width: `${Math.min(100, pctToDate)}%` }}
                      />
                    </div>
                    <div className="font-extrabold text-[12px] w-10 text-right">{pctToDate}%</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_1.4fr] gap-3 px-5 py-5 bg-ink text-cream items-center print-break-inside">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
              Total — Draw No.{payApp.drawNumber}
            </div>
            <div className="text-right font-black text-lg">{formatMoney(payApp.totalContract)}</div>
            <div className="text-right font-black text-lg">{formatMoney(payApp.totalPrevious)}</div>
            <div className="text-right font-black text-2xl text-orange-l">{formatMoney(payApp.totalThisDraw)}</div>
            <div className="text-right font-black text-lg">{formatMoney(payApp.totalBalance)}</div>
            <div>
              <div className="flex items-center justify-end gap-2">
                <div className="flex-1 h-1.5 bg-cream/20 max-w-[120px]">
                  <div className="h-full bg-orange" style={{ width: `${completionPct}%` }} />
                </div>
                <div className="font-black text-[12px] w-10 text-right">{completionPct}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {payApp.notes ? (
          <div className="bg-paper border-2 border-ink p-5 mt-6 print-break-inside">
            <div className="text-[9px] font-mono font-extrabold uppercase tracking-[0.15em] text-ink-50 mb-2">{'// Notes'}</div>
            <p className="text-[13px] text-ink-70 whitespace-pre-wrap leading-relaxed">{payApp.notes}</p>
          </div>
        ) : null}

        {/* Acknowledge (hidden in print) */}
        <div className="no-print bg-paper border-2 border-ink p-7 mt-6 text-center">
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

        <p className="no-print text-center text-[11px] text-ink-50 mt-8 font-mono uppercase tracking-[0.1em]">
          Private, secure pay application link · UDGOK Construction · Built with UDGOK CMS
        </p>
      </main>
    </div>
  );
}
