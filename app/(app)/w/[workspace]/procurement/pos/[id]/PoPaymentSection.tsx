/**
 * PO payment section — shows the invoice lifecycle on the
 * PO detail page. Buyer sees:
 *   - Each invoice with status badge, amount, submitted-by
 *   - "Approve / dispute / mark paid" buttons (role-gated)
 *   - Upload invoice form (manual entry from email)
 *   - "Request invoice from vendor" button
 *
 * The page also surfaces the workspace's invoice email
 * (settings.invoiceEmail) so the buyer can copy it into
 * a reply to the vendor.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  requestInvoiceAction,
  uploadInvoiceAction,
  approveInvoiceAction,
  disputeInvoiceAction,
  markInvoicePaidAction,
} from '@/lib/procurement/po-invoice-actions';
import { fmtDate } from '@/lib/format/currency';

interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  status: 'SUBMITTED' | 'APPROVED' | 'DISPUTED' | 'PAID' | 'VOID';
  submittedByEmail: string;
  receivedAt: string;
  approvedAt: string | null;
  approvedById: string | null;
  disputedAt: string | null;
  disputedReason: string | null;
  paidAt: string | null;
  paidMethod: string | null;
  paidReference: string | null;
  paidById: string | null;
  notes: string | null;
}

const INVOICE_STATUS_COLOR: Record<string, string> = {
  SUBMITTED: 'bg-info/15 text-info',
  APPROVED: 'bg-success/15 text-success',
  DISPUTED: 'bg-error/15 text-error',
  PAID: 'bg-ink-50/15 text-ink-50',
  VOID: 'bg-ink-50/15 text-ink-50',
};

const fmt$ = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PoPaymentSection({
  workspaceSlug,
  poId,
  poStatus,
  poNumber,
  vendorName,
  settings,
  invoices,
}: {
  workspaceSlug: string;
  poId: string;
  poStatus: string;
  poNumber: string;
  vendorName: string;
  settings: {
    invoiceEmail: string;
    invoiceEmailCc: string | null;
    allowAch: boolean;
    allowCard: boolean;
    allowCheck: boolean;
    allowPaymentLink: boolean;
    checkPayableTo: string | null;
    checkMailTo: string | null;
    achInstructions: string | null;
  };
  invoices: InvoiceDto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Upload form state
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invAmount, setInvAmount] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invNotes, setInvNotes] = useState('');

  function requestInvoice() {
    if (!confirm(`Send "${vendorName}" a request to send the final invoice for ${poNumber}?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await requestInvoiceAction({ workspaceSlug, poId });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function submitUpload() {
    setError(null);
    startTransition(async () => {
      const res = await uploadInvoiceAction({
        workspaceSlug,
        poId,
        invoiceNumber: invNumber.trim(),
        invoiceDate: invDate,
        invoiceAmount: parseFloat(invAmount) || 0,
        submittedByEmail: invEmail.trim() || undefined,
        notes: invNotes.trim() || undefined,
      });
      if (res.ok) {
        setShowUpload(false);
        setInvNumber('');
        setInvAmount('');
        setInvNotes('');
        setInvEmail('');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onApprove(invoiceId: string) {
    setError(null);
    startTransition(async () => {
      const res = await approveInvoiceAction({ workspaceSlug, invoiceId });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function onDispute(invoiceId: string, reason: string) {
    if (!reason.trim()) {
      setError('Please give a reason for the dispute');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await disputeInvoiceAction({ workspaceSlug, invoiceId, reason: reason.trim() });
      if (res.ok) {
        setDisputingId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onMarkPaid(invoiceId: string, method: 'ACH' | 'CARD' | 'CHECK' | 'WIRE', reference: string) {
    if (!reference.trim()) {
      setError('Reference number is required');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await markInvoicePaidAction({
        workspaceSlug,
        invoiceId,
        paidMethod: method,
        paidReference: reference.trim(),
      });
      if (res.ok) {
        setPayingId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const isClosed = poStatus === 'CANCELLED' || poStatus === 'CLOSED';

  return (
    <section className="mt-6 bg-paper border-2 border-ink">
      <div className="px-4 py-2 border-b-2 border-ink flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {'// Payment'}
        </div>
        <div className="text-[10px] text-ink-50 font-mono">
          {invoices.length} invoice{invoices.length === 1 ? '' : 's'} ·{' '}
          {invoices.filter((i) => i.status === 'PAID').length} paid
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Invoice email reminder */}
        <div className="px-3 py-2 bg-cream-2 border border-line text-[11px] text-ink-70">
          <div className="font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            {'// Send invoices to'}
          </div>
          <div className="font-mono text-[13px]">
            {settings.invoiceEmail}
            {settings.invoiceEmailCc ? ` (cc: ${settings.invoiceEmailCc})` : ''}
          </div>
        </div>

        {error ? (
          <div className="px-3 py-2 bg-error/10 border border-error text-[12px] text-error font-semibold">
            ⚠ {error}
          </div>
        ) : null}

        {/* Action bar */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={requestInvoice}
            disabled={pending || isClosed}
            className="px-3 py-2 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {pending ? 'Sending…' : '✉ Request invoice from vendor'}
          </button>
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            disabled={pending || isClosed}
            className="px-3 py-2 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {showUpload ? '✕ Cancel upload' : '+ Upload invoice'}
          </button>
        </div>

        {/* Upload form */}
        {showUpload ? (
          <div className="border border-line p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                  Invoice # *
                </div>
                <input
                  value={invNumber}
                  onChange={(ev) => setInvNumber(ev.target.value)}
                  placeholder="INV-2026-0001"
                  className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
                />
              </label>
              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                  Date *
                </div>
                <input
                  type="date"
                  value={invDate}
                  onChange={(ev) => setInvDate(ev.target.value)}
                  className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
                />
              </label>
              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                  Amount ($) *
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={invAmount}
                  onChange={(ev) => setInvAmount(ev.target.value)}
                  className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
                />
              </label>
            </div>
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                From (vendor email)
              </div>
              <input
                type="email"
                value={invEmail}
                onChange={(ev) => setInvEmail(ev.target.value)}
                placeholder="ap@vendor.com"
                className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
              />
            </label>
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                Notes
              </div>
              <textarea
                value={invNotes}
                onChange={(ev) => setInvNotes(ev.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 border border-line text-[12px]"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={submitUpload}
                disabled={pending || !invNumber.trim() || !invDate || !invAmount}
                className="px-4 py-2 bg-orange text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Save invoice'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <div className="text-[12px] text-ink-50 text-center py-4 border border-dashed border-line">
            No invoices yet. Click &ldquo;Request invoice from vendor&rdquo; or &ldquo;Upload invoice&rdquo; to start.
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="border border-line p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-[13px] font-extrabold">
                      {inv.invoiceNumber}
                      <span className="ml-2 text-[12px] font-mono text-ink-70">{fmt$(inv.invoiceAmount)}</span>
                    </div>
                    <div className="text-[10px] font-mono text-ink-50">
                      from {inv.submittedByEmail} ·{' '}
                      {fmtDate(inv.invoiceDate)} ·{' '}
                      received {fmtDate(inv.receivedAt)}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${INVOICE_STATUS_COLOR[inv.status] ?? 'bg-ink-50/15 text-ink-50'}`}
                  >
                    {inv.status}
                  </span>
                </div>

                {inv.disputedReason ? (
                  <div className="mt-2 px-3 py-2 bg-error/10 border border-error/40 text-[11px] text-ink-70">
                    <span className="font-extrabold text-error">Disputed:</span> {inv.disputedReason}
                  </div>
                ) : null}
                {inv.notes ? (
                  <div className="mt-2 px-3 py-2 bg-cream-2 border border-line text-[11px] text-ink-70">
                    {inv.notes}
                  </div>
                ) : null}
                {inv.paidAt ? (
                  <div className="mt-2 text-[10px] font-mono text-ink-50">
                    Paid {fmtDate(inv.paidAt)} via {inv.paidMethod} · ref {inv.paidReference}
                  </div>
                ) : null}

                {/* Action row */}
                {!isClosed && inv.status !== 'VOID' ? (
                  <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-line">
                    {inv.status === 'SUBMITTED' || inv.status === 'DISPUTED' ? (
                      <button
                        type="button"
                        onClick={() => onApprove(inv.id)}
                        disabled={pending}
                        className="px-3 py-1.5 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] hover:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    ) : null}
                    {inv.status !== 'PAID' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setDisputingId(disputingId === inv.id ? null : inv.id)}
                          disabled={pending}
                          className="px-3 py-1.5 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error hover:text-paper disabled:opacity-50"
                        >
                          Dispute
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayingId(payingId === inv.id ? null : inv.id)}
                          disabled={pending || inv.status === 'SUBMITTED' || inv.status === 'DISPUTED'}
                          title={
                            inv.status === 'SUBMITTED' || inv.status === 'DISPUTED'
                              ? 'Approve first, then mark paid'
                              : undefined
                          }
                          className="px-3 py-1.5 border-2 border-ink text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {disputingId === inv.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Why is this invoice being disputed?"
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
                          onDispute(inv.id, (ev.target as HTMLTextAreaElement).value);
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-line text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={(ev) => {
                        const ta = (ev.currentTarget.previousElementSibling as HTMLTextAreaElement);
                        onDispute(inv.id, ta.value);
                      }}
                      disabled={pending}
                      className="px-3 py-1.5 bg-error text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] hover:opacity-90"
                    >
                      Submit dispute
                    </button>
                  </div>
                ) : null}

                {payingId === inv.id ? (
                  <MarkPaidForm
                    onSubmit={(method, reference) => onMarkPaid(inv.id, method, reference)}
                    pending={pending}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MarkPaidForm({
  onSubmit,
  pending,
}: {
  onSubmit: (method: 'ACH' | 'CARD' | 'CHECK' | 'WIRE', reference: string) => void;
  pending: boolean;
}) {
  const [method, setMethod] = useState<'ACH' | 'CARD' | 'CHECK' | 'WIRE'>('ACH');
  const [ref, setRef] = useState('');
  return (
    <div className="mt-2 space-y-2 p-2 bg-cream-2 border border-line">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
            Method
          </div>
          <select
            value={method}
            onChange={(ev) => setMethod(ev.target.value as 'ACH' | 'CARD' | 'CHECK' | 'WIRE')}
            className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
          >
            <option value="ACH">ACH</option>
            <option value="CARD">Card</option>
            <option value="CHECK">Check</option>
            <option value="WIRE">Wire</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
            Reference # (check #, ACH trace, Stripe charge)
          </div>
          <input
            value={ref}
            onChange={(ev) => setRef(ev.target.value)}
            placeholder="e.g. 2026-008827 or pi_3Oqr..."
            className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => onSubmit(method, ref)}
        disabled={pending || !ref.trim()}
        className="px-3 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Confirm payment'}
      </button>
    </div>
  );
}
