/**
 * PO vendor response section — shows the vendor's reply
 * on the PO detail page. Buyer sees:
 *   - Response type badge (ACCEPTED / COUNTERED / REJECTED)
 *   - Payment method chosen + detail
 *   - Vendor reference #
 *   - Per-line overrides (for COUNTERED)
 *   - Signed by: name, email, when
 *   - For COUNTERED: accept / reject counter buttons
 *
 * Tenant-scoped, role-gated actions.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptCounterAction, rejectCounterAction } from '@/lib/procurement/po-response-actions';
import { fmtDateTimeUtc } from '@/lib/format/currency';

interface PoLine {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
}

interface ResponseLine {
  id: string;
  poLineId: string;
  isConfirmed: boolean;
  confirmedQty: number | null;
  confirmedPrice: number | null;
  backorderQty: number | null;
  shipDate: string | null;
  substituteSku: string | null;
  notes: string | null;
}

interface ResponseDto {
  id: string;
  responseType: 'ACCEPTED' | 'COUNTERED' | 'REJECTED' | 'INFO_ONLY';
  paymentMethod: 'ON_FILE' | 'PAYMENT_LINK' | 'INVOICE_BY_EMAIL' | 'CHECK';
  paymentMethodDetail: string | null;
  vendorReference: string | null;
  notes: string | null;
  signedByName: string;
  signedByEmail: string;
  submittedAt: string;
  lines: ResponseLine[];
}

const RESPONSE_TYPE_COLOR: Record<string, string> = {
  ACCEPTED: 'bg-success/15 text-success',
  COUNTERED: 'bg-warning/15 text-warning',
  REJECTED: 'bg-error/15 text-error',
  INFO_ONLY: 'bg-info/15 text-info',
};

const PAYMENT_LABEL: Record<string, string> = {
  ON_FILE: 'Payment on file',
  PAYMENT_LINK: 'Payment link requested',
  INVOICE_BY_EMAIL: 'Invoice by email',
  CHECK: 'Check',
};

export function PoResponseSection({
  workspaceSlug,
  poId,
  poStatus,
  poNumber,
  vendorName,
  poLines,
  response,
}: {
  workspaceSlug: string;
  poId: string;
  poStatus: string;
  poNumber: string;
  vendorName: string;
  poLines: PoLine[];
  response: ResponseDto;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isCounter = response.responseType === 'COUNTERED';
  const isOpenCounter = isCounter && poStatus !== 'CANCELLED';

  function onAcceptCounter() {
    if (!confirm(`Accept ${vendorName}'s counter for ${poNumber}? This creates a new PO (${poNumber}-R1) and cancels the original.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await acceptCounterAction({
        workspaceSlug,
        poId,
        responseId: response.id,
      });
      if (res.ok) {
        router.push(`/w/${workspaceSlug}/procurement/pos/${res.newPoId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onRejectCounter() {
    if (!rejectReason.trim()) {
      setError('Please give a reason for rejecting the counter');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await rejectCounterAction({
        workspaceSlug,
        poId,
        responseId: response.id,
        reason: rejectReason.trim(),
      });
      if (res.ok) {
        setShowRejectForm(false);
        setRejectReason('');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  // Build a line-by-line diff for COUNTERED responses.
  const lineById = new Map(poLines.map((l) => [l.id, l]));
  const counterLines = response.lines
    .map((rl) => ({ rl, orig: lineById.get(rl.poLineId) }))
    .filter((x): x is { rl: ResponseLine; orig: PoLine } => x.orig != null);
  const hasLineDiffs = counterLines.some(
    (x) =>
      x.orig.quantity !== (x.rl.confirmedQty ?? x.orig.quantity) ||
      x.orig.unitPrice !== (x.rl.confirmedPrice ?? x.orig.unitPrice) ||
      !x.rl.isConfirmed ||
      x.rl.backorderQty != null ||
      x.rl.substituteSku != null,
  );

  return (
    <section className="mt-6 bg-paper border-2 border-ink">
      <div className="px-4 py-2 border-b-2 border-ink flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {'// Vendor response'}
        </div>
        <span
          className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${RESPONSE_TYPE_COLOR[response.responseType] ?? 'bg-ink-50/15 text-ink-50'}`}
        >
          {response.responseType.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Signed by
            </div>
            <div className="font-extrabold">{response.signedByName}</div>
            <div className="text-[11px] text-ink-70 font-mono">{response.signedByEmail}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Submitted
            </div>
            <div className="font-mono">{fmtDateTimeUtc(response.submittedAt)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Payment method
            </div>
            <div className="font-mono">
              {PAYMENT_LABEL[response.paymentMethod]}
              {response.paymentMethodDetail ? ` — ${response.paymentMethodDetail}` : ''}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Vendor reference
            </div>
            <div className="font-mono">{response.vendorReference || '—'}</div>
          </div>
        </div>

        {response.notes ? (
          <div className="px-3 py-2 bg-cream-2 border border-line text-[12px] text-ink-70 whitespace-pre-wrap">
            <span className="font-extrabold text-ink-50 mr-1">Vendor note:</span>
            {response.notes}
          </div>
        ) : null}

        {/* Per-line diff (COUNTERED only) */}
        {isCounter && hasLineDiffs ? (
          <div className="border border-line">
            <div className="px-3 py-1.5 bg-cream-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Line changes
            </div>
            <table className="w-full text-[11px]">
              <thead className="text-ink-50 text-[9px] font-mono uppercase tracking-[0.1em]">
                <tr>
                  <th className="px-2 py-1.5 text-left">Description</th>
                  <th className="px-2 py-1.5 text-right">Orig Qty</th>
                  <th className="px-2 py-1.5 text-right">New Qty</th>
                  <th className="px-2 py-1.5 text-right">Orig $</th>
                  <th className="px-2 py-1.5 text-right">New $</th>
                  <th className="px-2 py-1.5 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {counterLines.map(({ rl, orig }) => {
                  const newQty = rl.confirmedQty ?? orig.quantity;
                  const newPrice = rl.confirmedPrice ?? orig.unitPrice ?? 0;
                  const newTotal = newQty * newPrice;
                  const origTotal = orig.quantity * (orig.unitPrice ?? 0);
                  const diff = Math.round((newTotal - origTotal) * 100) / 100;
                  return (
                    <tr key={rl.id} className="border-t border-line align-top">
                      <td className="px-2 py-1.5">
                        <div className="font-extrabold">{orig.description}</div>
                        {!rl.isConfirmed ? (
                          <div className="text-[10px] text-error font-mono mt-0.5">
                            ⚠ vendor cannot ship
                          </div>
                        ) : null}
                        {rl.backorderQty ? (
                          <div className="text-[10px] text-warning font-mono mt-0.5">
                            backorder: {rl.backorderQty}
                          </div>
                        ) : null}
                        {rl.substituteSku ? (
                          <div className="text-[10px] text-info font-mono mt-0.5">
                            sub: {rl.substituteSku}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{orig.quantity.toString()}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {rl.confirmedQty ? rl.confirmedQty.toString() : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        ${(orig.unitPrice ?? 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {rl.confirmedPrice ? `$${rl.confirmedPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        <div className="text-ink-70">{rl.notes ?? ''}</div>
                        {diff !== 0 ? (
                          <div className={`font-mono mt-0.5 ${diff > 0 ? 'text-error' : 'text-success'}`}>
                            {diff > 0 ? '+' : ''}${diff.toFixed(2)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* COUNTER actions */}
        {isOpenCounter ? (
          <div className="flex flex-col gap-2 pt-2 border-t border-line">
            {error ? (
              <div className="px-3 py-2 bg-error/10 border border-error text-[12px] text-error font-semibold">
                ⚠ {error}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onAcceptCounter}
                disabled={pending}
                className="px-4 py-2 bg-success text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Accepting…' : '✓ Accept counter (creates new PO)'}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm((v) => !v)}
                disabled={pending}
                className="px-4 py-2 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream disabled:opacity-50"
              >
                {showRejectForm ? 'Cancel reject' : '✗ Reject counter'}
              </button>
            </div>
            {showRejectForm ? (
              <div className="space-y-2">
                <label className="block">
                  <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                    Reason (sent to vendor)
                  </div>
                  <textarea
                    value={rejectReason}
                    onChange={(ev) => setRejectReason(ev.target.value)}
                    rows={2}
                    placeholder="e.g. our budget is fixed, please honor original pricing"
                    className="w-full px-2 py-1.5 border border-line text-[12px]"
                  />
                </label>
                <button
                  type="button"
                  onClick={onRejectCounter}
                  disabled={pending || !rejectReason.trim()}
                  className="px-4 py-2 bg-error text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] hover:opacity-90 disabled:opacity-50"
                >
                  Confirm reject
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
