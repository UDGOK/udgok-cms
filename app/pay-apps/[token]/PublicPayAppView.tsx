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

const formatMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    // For the public page we record the acknowledgment by hitting the server action.
    // Real implementation would have a separate acknowledgeAction; for v1 we use a fetch.
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

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <header className="bg-ink text-cream px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-black text-2xl">UDG<span className="text-orange">OK</span></span>
          <span className="font-mono text-[10px] tracking-[0.15em] text-cream/40 uppercase">
            Construction Management
          </span>
        </div>
        <div className="font-mono text-[10px] tracking-[0.12em] text-cream/40 uppercase">
          Pay Application · #{payApp.drawNumber}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1 bg-orange text-paper font-extrabold uppercase tracking-[0.15em] text-xs mb-4">
            Pay Application
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-2">{payApp.project.name}</h1>
          <p className="text-ink-50 text-base">
            {payApp.project.client?.name ?? '—'} · Period {payApp.periodStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – {payApp.periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-ink bg-paper mb-8">
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
        <div className="bg-paper border-2 border-ink mb-8">
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
          <div className="bg-paper border-2 border-ink p-6 mb-8">
            <h2 className="label-eyebrow mb-3">{'// Notes'}</h2>
            <p className="text-[14px] text-ink-70 whitespace-pre-wrap">{payApp.notes}</p>
          </div>
        ) : null}

        {/* Acknowledge */}
        <div className="bg-paper border-2 border-ink p-8 text-center">
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

        <p className="text-center text-[11px] text-ink-50 mt-8">
          This is a private, secure pay application link. UDGOK Construction · Built with UDGOK CMS
        </p>
      </main>
    </div>
  );
}
