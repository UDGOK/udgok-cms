'use client';

/**
 * Import-invoice modal.
 *
 * Opens a structured form where the buyer pastes the data
 * from a paid (or future) invoice and clicks "Import". The
 * server action does the rest — creates ProjectDivision
 * rows if missing, creates the PayApp with the right
 * status/date/totals, and creates the PayAppDivision lines.
 *
 * Pre-fills the PFG — Grove INV-2026-0729-GRV scenario
 * since that's the most common case the user hits. The
 * "Reset to sample" button restores the pre-filled state.
 *
 * Why a modal: the alternative is a multi-step "generate
 * a new pay app" form that's tedious to use for backfill
 * of historical invoices. A modal with a structured
 * payload (and the JSON editor for power users) is the
 * fastest path to getting data in.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { importInvoiceAction } from '@/lib/pay-apps/import-invoice-action';

interface DivisionLine {
  code: string;
  trade: string;
  amount: string; // string in form, parsed to number on submit
}

interface Props {
  workspaceSlug: string;
  projectId: string;
  nextDrawNumber: number;
  onClose: () => void;
}

// Sample payload — matches the PFG — Grove invoice. Buyer
// can edit any field before submitting, or clear the lines
// and start fresh.
const SAMPLE: {
  invoiceNumber: string;
  invoiceDate: string;
  paymentDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID';
  clientName: string;
  clientEmail: string;
  notes: string;
  lines: DivisionLine[];
} = {
  invoiceNumber: 'INV-2026-0729-GRV',
  invoiceDate: '2026-07-29',
  paymentDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  status: 'PAID',
  clientName: 'Yuba Parajuli',
  clientEmail: 'yuba@pfgstores.com',
  notes: 'EIFS & Plywood Installation — 70% complete at invoice date.',
  lines: [
    { code: '04', trade: 'Masonry', amount: '4022.00' },
    { code: '06', trade: 'Wood, Plastics & Composites', amount: '4712.00' },
    { code: '07', trade: 'Thermal & Moisture Protection', amount: '8680.00' },
  ],
};

export function ImportInvoiceModal({
  workspaceSlug,
  projectId,
  nextDrawNumber,
  onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drawNumber, setDrawNumber] = useState(String(nextDrawNumber));
  const [status, setStatus] = useState<'DRAFT' | 'SENT' | 'PAID'>(SAMPLE.status);
  const [invoiceNumber, setInvoiceNumber] = useState(SAMPLE.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(SAMPLE.invoiceDate);
  const [paymentDate, setPaymentDate] = useState(SAMPLE.paymentDate);
  const [clientName, setClientName] = useState(SAMPLE.clientName);
  const [clientEmail, setClientEmail] = useState(SAMPLE.clientEmail);
  const [notes, setNotes] = useState(SAMPLE.notes);
  const [lines, setLines] = useState<DivisionLine[]>(SAMPLE.lines);
  const [showJson, setShowJson] = useState(false);

  function updateLine(idx: number, patch: Partial<DivisionLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      { code: '', trade: '', amount: '0' },
    ]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }
  function resetSample() {
    setDrawNumber(String(nextDrawNumber));
    setStatus(SAMPLE.status);
    setInvoiceNumber(SAMPLE.invoiceNumber);
    setInvoiceDate(SAMPLE.invoiceDate);
    setPaymentDate(SAMPLE.paymentDate);
    setClientName(SAMPLE.clientName);
    setClientEmail(SAMPLE.clientEmail);
    setNotes(SAMPLE.notes);
    setLines(SAMPLE.lines);
  }

  const sum = lines.reduce((a, l) => a + (Number(l.amount) || 0), 0);

  function submit() {
    setError(null);
    // Validate inline so the buyer sees issues before
    // hitting the action.
    if (!invoiceNumber.trim()) return setError('Invoice number is required');
    if (!invoiceDate) return setError('Invoice date is required');
    if (!paymentDate) return setError('Payment date is required');
    if (lines.length === 0) return setError('Add at least one line');
    for (const [i, l] of lines.entries()) {
      if (!l.code.trim()) return setError(`Line ${i + 1}: code is required`);
      if (!l.trade.trim()) return setError(`Line ${i + 1}: trade is required`);
      if (!Number.isFinite(Number(l.amount)) || Number(l.amount) < 0) {
        return setError(`Line ${i + 1}: amount must be a non-negative number`);
      }
    }

    const payload = {
      projectId,
      drawNumber: Number(drawNumber),
      status,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      paymentDate,
      clientName: clientName.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: lines.map((l) => ({
        code: l.code.trim(),
        trade: l.trade.trim(),
        amount: Number(l.amount),
      })),
    };

    startTransition(async () => {
      const fd = new FormData();
      fd.set('payload', JSON.stringify(payload));
      const res = await importInvoiceAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        // Navigate to the imported pay app so the buyer
        // sees the result.
        router.push(`/w/${workspaceSlug}/projects/${projectId}/pay-apps/${res.payAppId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/50 overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border-2 border-ink max-w-3xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-cream/60">
              {'// PROCUREMENT / PAY APPS'}
            </div>
            <h2 className="text-lg font-black">Import invoice</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-cream hover:text-paper text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-[12px] text-ink-70 bg-info/10 border border-info p-2">
            Pre-filled with the PFG — Grove invoice (INV-2026-0729-GRV, paid 2 weeks ago). Edit any field, or
            clear the lines and start fresh for a different invoice. The next free draw number is{' '}
            <span className="font-mono font-extrabold">#{nextDrawNumber}</span>.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Invoice #">
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
              />
            </Field>
            <Field label="Draw #">
              <input
                type="number"
                min="1"
                value={drawNumber}
                onChange={(e) => setDrawNumber(e.target.value)}
                className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px] font-mono"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'SENT' | 'PAID')}
                className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
              >
                <option value="DRAFT">DRAFT (not yet billed)</option>
                <option value="SENT">SENT (sent to client)</option>
                <option value="PAID">PAID (paid in full)</option>
              </select>
            </Field>
            <Field label="Invoice date">
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
              />
            </Field>
            <Field label={status === 'PAID' ? 'Payment date' : 'Period end'}>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
              />
            </Field>
            <Field label="Client">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Yuba Parajuli"
                className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
              />
            </Field>
            <Field label="Client email" wide>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px] font-mono"
              />
            </Field>
          </div>

          <Field label="Notes" wide>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px] resize-y"
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                {'// Line items (CSI division · trade · amount)'}
              </div>
              <button
                type="button"
                onClick={addLine}
                className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] border border-line hover:border-ink"
              >
                + Add line
              </button>
            </div>
            <div className="space-y-1">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    placeholder="04"
                    value={l.code}
                    onChange={(e) => updateLine(i, { code: e.target.value })}
                    className="col-span-2 px-2 py-1.5 bg-cream border border-line text-ink text-[12px] font-mono"
                  />
                  <input
                    placeholder="Masonry"
                    value={l.trade}
                    onChange={(e) => updateLine(i, { trade: e.target.value })}
                    className="col-span-7 px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.amount}
                    onChange={(e) => updateLine(i, { amount: e.target.value })}
                    className="col-span-2 px-2 py-1.5 bg-cream border border-line text-ink text-[12px] font-mono text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="col-span-1 text-error text-[12px] hover:bg-error/10 py-1.5"
                    title="Remove line"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-[12px] font-mono">
              Subtotal: <span className="font-extrabold">${sum.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowJson((v) => !v)}
              className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
            >
              {showJson ? '− Hide' : '+ Show'} JSON payload
            </button>
            {showJson ? (
              <pre className="mt-2 bg-cream border border-line p-2 text-[10px] font-mono overflow-x-auto max-h-48">
                {JSON.stringify(
                  {
                    projectId,
                    drawNumber: Number(drawNumber) || 0,
                    status,
                    invoiceNumber,
                    invoiceDate,
                    paymentDate,
                    clientName: clientName || undefined,
                    clientEmail: clientEmail || undefined,
                    notes: notes || undefined,
                    lines: lines.map((l) => ({
                      code: l.code,
                      trade: l.trade,
                      amount: Number(l.amount) || 0,
                    })),
                  },
                  null,
                  2,
                )}
              </pre>
            ) : null}
          </div>

          {error ? (
            <div className="bg-error/10 border border-error p-2 text-[12px] text-error font-semibold">
              ⚠ {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={resetSample}
              disabled={pending}
              className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink disabled:opacity-50"
            >
              Reset to sample
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="px-3 py-2 border-2 border-line text-[11px] font-extrabold uppercase tracking-[0.12em] hover:border-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="px-4 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
              >
                {pending ? 'Importing…' : `Import draw #${drawNumber}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${wide ? 'md:col-span-3' : ''}`}>
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
