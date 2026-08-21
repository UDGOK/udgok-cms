'use client';

/**
 * PO response form — the heart of the vendor portal.
 *
 * Renders:
 *   - PO summary (number, vendor, terms, dates)
 *   - Delivery block (if any)
 *   - Line items table with per-line confirm / counter / backorder
 *   - Payment method picker (on file / link / invoice / check)
 *   - Sign-and-submit form (name + email + reference + notes)
 *
 * Outcomes:
 *   - Accept  → submits with responseType=ACCEPTED, all lines
 *     confirmed, payment method chosen
 *   - Counter → opens editable per-line form, submits with
 *     responseType=COUNTERED + line overrides
 *   - Reject  → opens reject form (reason required), submits
 *     with responseType=REJECTED
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitPoResponseAction } from '@/lib/procurement/po-vendor-intake';

type FormData = {
  id: string;
  number: string;
  issuedAt: Date | null;
  terms: string | null;
  shipTo: string | null;
  deliveryName: string | null;
  deliveryAddress: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryContactEmail: string | null;
  vendor: {
    id: string;
    name: string;
    defaultTerms: string | null;
    paymentMethods: Array<{
      id: string;
      methodType: 'ACH' | 'CARD' | 'CHECK';
      isDefault: boolean;
      nickname: string | null;
      last4: string | null;
      achBankName: string | null;
      achRoutingLast4: string | null;
      achAccountLast4: string | null;
      cardBrand: string | null;
    }>;
  };
  contact: { id: string; name: string; email: string; phone: string | null } | null;
  // Vendor contacts array — we use contacts[0] as the
  // pre-fill target on the form.
  contacts?: Array<{ id: string; name: string; email: string; phone: string | null }>;
  lines: Array<{
    id: string;
    position: number;
    description: string;
    vendorSku: string | null;
    quantity: number;
    uom: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  workspace: {
    id: string;
    name: string;
    paymentSettings: {
      invoiceEmail: string;
      invoiceEmailCc: string | null;
      defaultTerms: string;
      paymentLinkBaseUrl: string | null;
      achInstructions: string | null;
      checkPayableTo: string | null;
      checkMailTo: string | null;
      allowAch: boolean;
      allowCard: boolean;
      allowCheck: boolean;
      allowPaymentLink: boolean;
    } | null;
  };
};

type PaymentMethod = 'ON_FILE' | 'PAYMENT_LINK' | 'INVOICE_BY_EMAIL' | 'CHECK';
type ResponseType = 'ACCEPTED' | 'COUNTERED' | 'REJECTED';

interface LineEdit {
  isConfirmed: boolean;
  confirmedQty: string;
  confirmedPrice: string;
  backorderQty: string;
  shipDate: string;
  substituteSku: string;
  substituteDescription: string;
  notes: string;
}

export function PoResponseForm({ po, token }: { po: FormData; token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Outcome state machine: 'CHOOSING' (default) → 'ACCEPT' |
  // 'COUNTER' | 'REJECT' (the form for that outcome opens).
  const [outcome, setOutcome] = useState<ResponseType | 'CHOOSING'>('CHOOSING');

  // Sign-and-submit fields. Pre-fill name/email from the
  // primary contact so the vendor doesn't have to retype.
  // Vendor contacts come in as `contacts[]`; we use [0].
  const firstContact = po.contacts?.[0] ?? po.contact;
  const [signedByName, setSignedByName] = useState(firstContact?.name ?? '');
  const [signedByEmail, setSignedByEmail] = useState(firstContact?.email ?? '');
  const [signedByPhone, setSignedByPhone] = useState(firstContact?.phone ?? '');
  const [vendorReference, setVendorReference] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Payment method picker.
  const settings = po.workspace.paymentSettings;
  const defaultPm: PaymentMethod = po.vendor.paymentMethods.length > 0
    ? 'ON_FILE'
    : settings?.invoiceEmail
      ? 'INVOICE_BY_EMAIL'
      : 'CHECK';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPm);
  const [paymentMethodDetail, setPaymentMethodDetail] = useState('');

  // Per-line edit state. Pre-filled from the PO.
  const [lineEdits, setLineEdits] = useState<Record<string, LineEdit>>(() => {
    const out: Record<string, LineEdit> = {};
    for (const l of po.lines) {
      out[l.id] = {
        isConfirmed: true,
        confirmedQty: l.quantity.toString(),
        confirmedPrice: l.unitPrice.toString(),
        backorderQty: '',
        shipDate: '',
        substituteSku: '',
        substituteDescription: '',
        notes: '',
      };
    }
    return out;
  });

  function setLineEdit(lineId: string, patch: Partial<LineEdit>) {
    setLineEdits((prev) => ({ ...prev, [lineId]: { ...prev[lineId]!, ...patch } }));
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    const trimmedReason = rejectReason.trim();
    const trimmedName = signedByName.trim();
    const trimmedEmail = signedByEmail.trim();

    // Inline validation mirrors the server zod schema.
    const errs: Record<string, string> = {};
    if (!trimmedName) errs.signedByName = 'Name is required';
    if (!trimmedEmail) errs.signedByEmail = 'Email is required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) errs.signedByEmail = 'Valid email required';
    if (outcome === 'REJECTED' && !trimmedReason) errs.rejectReason = 'Please tell us why so we can plan around it';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    // Build the line overrides payload. On ACCEPTED we send
    // all lines confirmed; on COUNTERED we send only the
    // changed lines; on REJECTED we send an empty array
    // (the rejection is the only thing that matters).
    interface LinePayload {
      poLineId: string;
      isConfirmed: boolean;
      confirmedQty?: number;
      confirmedPrice?: number;
      backorderQty?: number;
      shipDate?: string;
      substituteSku?: string;
      substituteDescription?: string;
      notes?: string;
    }
    let lines: LinePayload[] = [];
    if (outcome !== 'REJECTED') {
      lines = po.lines.map((l) => {
        const e = lineEdits[l.id]!;
        return {
          poLineId: l.id,
          isConfirmed: e.isConfirmed,
          confirmedQty: e.confirmedQty ? Number(e.confirmedQty) : undefined,
          confirmedPrice: e.confirmedPrice ? Number(e.confirmedPrice) : undefined,
          backorderQty: e.backorderQty ? Number(e.backorderQty) : undefined,
          shipDate: e.shipDate || undefined,
          substituteSku: e.substituteSku || undefined,
          substituteDescription: e.substituteDescription || undefined,
          notes: e.notes || undefined,
        };
      });
    }

    startTransition(async () => {
      const res = await submitPoResponseAction({
        token,
        responseType: outcome as ResponseType,
        paymentMethod,
        paymentMethodDetail: paymentMethodDetail || undefined,
        vendorReference: vendorReference || undefined,
        notes: outcome === 'REJECTED' ? trimmedReason : (notes || undefined),
        signedByName: trimmedName,
        signedByEmail: trimmedEmail,
        signedByPhone: signedByPhone || undefined,
        lines,
      });
      if (res.ok) {
        router.push(`/p/${token}?submitted=1`);
        router.refresh();
      } else {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      }
    });
  }

  const s = settings;

  return (
    <main className="min-h-screen bg-cream py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Brand header */}
        <div className="mb-6">
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-50">
            {'// '}
            {po.workspace.name}
          </div>
          <h1 className="text-3xl font-black mt-1">Purchase order {po.number}</h1>
          <div className="mt-2 text-[12px] text-ink-70">
            For {po.vendor.name}
            {po.issuedAt ? ` · issued ${po.issuedAt.toLocaleDateString()}` : ''}
            {po.terms ? ` · ${po.terms}` : ''}
          </div>
        </div>

        {/* Delivery block */}
        {po.deliveryAddress || po.deliveryName || po.deliveryContactName ? (
          <div className="mb-4 px-4 py-3 bg-orange-50 border-l-4 border-orange">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange-d mb-1">
              {'// Deliver to'}
            </div>
            {po.deliveryName ? <div className="text-[14px] font-extrabold">{po.deliveryName}</div> : null}
            {po.deliveryAddress ? <div className="text-[12px] text-ink-70">{po.deliveryAddress}</div> : null}
            {po.deliveryContactName ? (
              <div className="text-[11px] text-ink-70 mt-1">
                On-site PoC: {po.deliveryContactName}
                {po.deliveryContactPhone ? ` · ${po.deliveryContactPhone}` : ''}
                {po.deliveryContactEmail ? ` · ${po.deliveryContactEmail}` : ''}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Line items table */}
        <div className="bg-paper border-2 border-ink overflow-hidden mb-6">
          <div className="px-4 py-2 border-b-2 border-ink flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
              {'// Line items'}
            </div>
            <div className="text-[10px] text-ink-50 font-mono">{po.lines.length} lines</div>
          </div>
          <table className="w-full text-[12px]">
            <thead className="bg-cream-2 text-ink-50 text-[9px] font-mono uppercase tracking-[0.1em]">
              <tr>
                <th className="px-2 py-1.5 text-left w-8">#</th>
                <th className="px-2 py-1.5 text-left">Description</th>
                <th className="px-2 py-1.5 text-right w-16">Qty</th>
                <th className="px-2 py-1.5 text-left w-12">UoM</th>
                <th className="px-2 py-1.5 text-right w-20">Unit $</th>
                <th className="px-2 py-1.5 text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => {
                const e = lineEdits[l.id]!;
                const edited = e.confirmedQty !== l.quantity.toString() || e.confirmedPrice !== l.unitPrice.toString();
                return (
                  <tr key={l.id} className="border-t border-line align-top">
                    <td className="px-2 py-2 font-mono text-ink-50">{l.position + 1}</td>
                    <td className="px-2 py-2">
                      <div className="font-extrabold">{l.description}</div>
                      {l.vendorSku ? (
                        <div className="text-[10px] text-ink-50 font-mono">SKU: {l.vendorSku}</div>
                      ) : null}
                      {outcome === 'COUNTERED' ? (
                        <div className="mt-1.5 space-y-1.5 text-[10px]">
                          <label className="flex items-center gap-1.5 text-ink-70">
                            <input
                              type="checkbox"
                              checked={e.isConfirmed}
                              onChange={(ev) => setLineEdit(l.id, { isConfirmed: ev.target.checked })}
                              className="w-3 h-3"
                            />
                            Can ship as ordered
                          </label>
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              placeholder="Qty"
                              value={e.confirmedQty}
                              onChange={(ev) => setLineEdit(l.id, { confirmedQty: ev.target.value })}
                              className="px-1.5 py-1 border border-line text-[11px] font-mono"
                            />
                            <input
                              placeholder="Unit $"
                              value={e.confirmedPrice}
                              onChange={(ev) => setLineEdit(l.id, { confirmedPrice: ev.target.value })}
                              className="px-1.5 py-1 border border-line text-[11px] font-mono"
                            />
                          </div>
                          <input
                            placeholder="Backorder qty (if partial ship)"
                            value={e.backorderQty}
                            onChange={(ev) => setLineEdit(l.id, { backorderQty: ev.target.value })}
                            className="w-full px-1.5 py-1 border border-line text-[11px] font-mono"
                          />
                          <input
                            placeholder="Substitute SKU (if suggesting a replacement)"
                            value={e.substituteSku}
                            onChange={(ev) => setLineEdit(l.id, { substituteSku: ev.target.value })}
                            className="w-full px-1.5 py-1 border border-line text-[11px] font-mono"
                          />
                          <input
                            placeholder="Note for this line (optional)"
                            value={e.notes}
                            onChange={(ev) => setLineEdit(l.id, { notes: ev.target.value })}
                            className="w-full px-1.5 py-1 border border-line text-[11px]"
                          />
                        </div>
                      ) : null}
                      {edited && outcome === 'COUNTERED' ? (
                        <div className="text-[10px] text-orange-d mt-1 font-mono">
                          was {l.quantity.toString()} × ${l.unitPrice.toFixed(2)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{l.quantity.toString()}</td>
                    <td className="px-2 py-2 text-[10px] font-mono">{l.uom}</td>
                    <td className="px-2 py-2 text-right font-mono">${l.unitPrice.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right font-mono font-extrabold">${l.lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink">
                <td colSpan={5} className="px-2 py-2 text-right text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                  Total
                </td>
                <td className="px-2 py-2 text-right font-mono font-extrabold text-orange text-[14px]">
                  ${po.lines.reduce((sum, l) => sum + l.lineTotal, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payment method picker */}
        {outcome !== 'REJECTED' ? (
          <div className="bg-paper border-2 border-ink p-5 mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-3">
              {'// Payment method'}
            </div>
            <div className="space-y-2">
              {po.vendor.paymentMethods.length > 0 && s?.allowAch !== false ? (
                <label className="flex items-start gap-2 text-[12px]">
                  <input
                    type="radio"
                    name="pm"
                    value="ON_FILE"
                    checked={paymentMethod === 'ON_FILE'}
                    onChange={() => setPaymentMethod('ON_FILE')}
                    className="mt-1"
                  />
                  <span>
                    <b>Use payment on file</b>
                    <div className="text-[11px] text-ink-50 mt-0.5">
                      {po.vendor.paymentMethods.map((m) => {
                        const desc =
                          m.methodType === 'ACH'
                            ? `ACH${m.achBankName ? ` · ${m.achBankName}` : ''}${m.achAccountLast4 ? ` ending ${m.achAccountLast4}` : ''}`
                            : m.methodType === 'CARD'
                              ? `${m.cardBrand ?? 'Card'}${m.last4 ? ` ending ${m.last4}` : ''}`
                              : `Check${m.last4 ? ` #${m.last4}` : ''}`;
                        return (
                          <div key={m.id} className="font-mono">
                            {m.nickname ? `${m.nickname} — ` : ''}
                            {desc}
                            {m.isDefault ? ' · default' : ''}
                          </div>
                        );
                      })}
                    </div>
                  </span>
                </label>
              ) : null}
              {s?.allowPaymentLink ? (
                <label className="flex items-start gap-2 text-[12px]">
                  <input
                    type="radio"
                    name="pm"
                    value="PAYMENT_LINK"
                    checked={paymentMethod === 'PAYMENT_LINK'}
                    onChange={() => setPaymentMethod('PAYMENT_LINK')}
                    className="mt-1"
                  />
                  <span>
                    <b>Send me a payment link</b>
                    <div className="text-[11px] text-ink-50 mt-0.5">
                      We&apos;ll email you a secure checkout link (Stripe).
                    </div>
                    {paymentMethod === 'PAYMENT_LINK' ? (
                      <div className="mt-1.5">
                        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                          Send link to
                        </label>
                        <input
                          type="email"
                          value={paymentMethodDetail || signedByEmail}
                          onChange={(ev) => setPaymentMethodDetail(ev.target.value)}
                          className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
                        />
                      </div>
                    ) : null}
                  </span>
                </label>
              ) : null}
              {s?.invoiceEmail ? (
                <label className="flex items-start gap-2 text-[12px]">
                  <input
                    type="radio"
                    name="pm"
                    value="INVOICE_BY_EMAIL"
                    checked={paymentMethod === 'INVOICE_BY_EMAIL'}
                    onChange={() => setPaymentMethod('INVOICE_BY_EMAIL')}
                    className="mt-1"
                  />
                  <span>
                    <b>I&apos;ll send an invoice to {s.invoiceEmail}</b>
                    <div className="text-[11px] text-ink-50 mt-0.5">
                      Email the final invoice (PDF or photo) to {s.invoiceEmail} with the PO number in the subject.
                      {s.invoiceEmailCc ? ` CC: ${s.invoiceEmailCc}.` : ''}
                    </div>
                  </span>
                </label>
              ) : null}
              {s?.allowCheck ? (
                <label className="flex items-start gap-2 text-[12px]">
                  <input
                    type="radio"
                    name="pm"
                    value="CHECK"
                    checked={paymentMethod === 'CHECK'}
                    onChange={() => setPaymentMethod('CHECK')}
                    className="mt-1"
                  />
                  <span>
                    <b>Pay by check</b>
                    <div className="text-[11px] text-ink-50 mt-0.5">
                      Make payable to {s.checkPayableTo ?? 'UDGOK Construction'}
                      {s.checkMailTo ? ` and mail to ${s.checkMailTo}` : ''}.
                    </div>
                  </span>
                </label>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Outcome chooser / form */}
        {outcome === 'CHOOSING' ? (
          <div className="space-y-3 mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
              {'// What would you like to do?'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setOutcome('ACCEPTED')}
                className="px-4 py-3 bg-success text-paper text-[12px] font-extrabold uppercase tracking-[0.12em] hover:opacity-90"
              >
                ✓ Accept PO
              </button>
              <button
                type="button"
                onClick={() => setOutcome('COUNTERED')}
                className="px-4 py-3 bg-orange text-paper text-[12px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
              >
                ⟲ Counter with changes
              </button>
              <button
                type="button"
                onClick={() => setOutcome('REJECTED')}
                className="px-4 py-3 border-2 border-error text-error text-[12px] font-extrabold uppercase tracking-[0.12em] hover:bg-error hover:text-paper"
              >
                ✗ Reject PO
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-paper border-2 border-ink p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                {'// '}
                {outcome === 'ACCEPTED' && 'Accepting PO as-is'}
                {outcome === 'COUNTERED' && 'Countering with changes'}
                {outcome === 'REJECTED' && 'Rejecting PO'}
              </div>
              <button
                type="button"
                onClick={() => setOutcome('CHOOSING')}
                className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
              >
                ← Back
              </button>
            </div>

            {/* Sign-and-submit fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                  Your name *
                </div>
                <input
                  value={signedByName}
                  onChange={(ev) => setSignedByName(ev.target.value)}
                  className="w-full px-2 py-1.5 border border-line text-[13px]"
                />
                {fieldErrors.signedByName ? (
                  <div className="text-[10px] text-error mt-0.5">{fieldErrors.signedByName}</div>
                ) : null}
              </label>
              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                  Email *
                </div>
                <input
                  type="email"
                  value={signedByEmail}
                  onChange={(ev) => setSignedByEmail(ev.target.value)}
                  className="w-full px-2 py-1.5 border border-line text-[13px] font-mono"
                />
                {fieldErrors.signedByEmail ? (
                  <div className="text-[10px] text-error mt-0.5">{fieldErrors.signedByEmail}</div>
                ) : null}
              </label>
            </div>

            {outcome !== 'REJECTED' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                      Your reference / order #
                    </div>
                    <input
                      value={vendorReference}
                      onChange={(ev) => setVendorReference(ev.target.value)}
                      placeholder="e.g. L-2026-8881"
                      className="w-full px-2 py-1.5 border border-line text-[13px] font-mono"
                    />
                  </label>
                  <label className="block">
                    <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                      Phone (optional)
                    </div>
                    <input
                      value={signedByPhone}
                      onChange={(ev) => setSignedByPhone(ev.target.value)}
                      className="w-full px-2 py-1.5 border border-line text-[13px] font-mono"
                    />
                  </label>
                </div>
                <label className="block">
                  <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                    Note to buyer (optional)
                  </div>
                  <textarea
                    value={notes}
                    onChange={(ev) => setNotes(ev.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 border border-line text-[13px]"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                  Reason for rejection (required) *
                </div>
                <textarea
                  value={rejectReason}
                  onChange={(ev) => setRejectReason(ev.target.value)}
                  rows={3}
                  placeholder="e.g. out of stock until Sept, will resubmit with new dates"
                  className="w-full px-2 py-1.5 border border-line text-[13px]"
                />
                {fieldErrors.rejectReason ? (
                  <div className="text-[10px] text-error mt-0.5">{fieldErrors.rejectReason}</div>
                ) : null}
              </label>
            )}

            {error ? (
              <div className="px-3 py-2 bg-error/10 border border-error text-[12px] text-error font-semibold">
                ⚠ {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="px-5 py-2.5 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
              >
                {pending
                  ? 'Submitting…'
                  : outcome === 'ACCEPTED'
                    ? '✓ Submit acceptance'
                    : outcome === 'COUNTERED'
                      ? '⟲ Submit counter'
                      : '✗ Submit rejection'}
              </button>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-8">
          Questions? Reply to the email you received.
        </div>
      </div>
    </main>
  );
}
