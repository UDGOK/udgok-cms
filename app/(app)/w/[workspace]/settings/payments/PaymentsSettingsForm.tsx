'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePaymentSettingsAction } from '@/lib/procurement/payment-settings-actions';

interface SettingsShape {
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
}

export function PaymentsSettingsForm({
  workspaceSlug,
  initial,
}: {
  workspaceSlug: string;
  initial: SettingsShape;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [invoiceEmail, setInvoiceEmail] = useState(initial.invoiceEmail);
  const [invoiceEmailCc, setInvoiceEmailCc] = useState(initial.invoiceEmailCc ?? '');
  const [defaultTerms, setDefaultTerms] = useState(initial.defaultTerms);
  const [paymentLinkBaseUrl, setPaymentLinkBaseUrl] = useState(initial.paymentLinkBaseUrl ?? '');
  const [achInstructions, setAchInstructions] = useState(initial.achInstructions ?? '');
  const [checkPayableTo, setCheckPayableTo] = useState(initial.checkPayableTo ?? '');
  const [checkMailTo, setCheckMailTo] = useState(initial.checkMailTo ?? '');
  const [allowAch, setAllowAch] = useState(initial.allowAch);
  const [allowCard, setAllowCard] = useState(initial.allowCard);
  const [allowCheck, setAllowCheck] = useState(initial.allowCheck);
  const [allowPaymentLink, setAllowPaymentLink] = useState(initial.allowPaymentLink);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await savePaymentSettingsAction({
        workspaceSlug,
        invoiceEmail: invoiceEmail.trim(),
        invoiceEmailCc: invoiceEmailCc.trim() || null,
        defaultTerms: defaultTerms.trim() || 'Net 30',
        paymentLinkBaseUrl: paymentLinkBaseUrl.trim() || null,
        achInstructions: achInstructions.trim() || null,
        checkPayableTo: checkPayableTo.trim() || null,
        checkMailTo: checkMailTo.trim() || null,
        allowAch,
        allowCard,
        allowCheck,
        allowPaymentLink,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="bg-paper border-2 border-ink">
      <div className="px-4 py-2 border-b-2 border-ink text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {'// Invoicing'}
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
              Invoice email (printed on every PO) *
            </div>
            <input
              type="email"
              value={invoiceEmail}
              onChange={(ev) => setInvoiceEmail(ev.target.value)}
              placeholder="ap@udgok.com"
              className="w-full px-3 py-2 border border-line text-[13px] font-mono"
            />
          </label>
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
              CC (optional)
            </div>
            <input
              type="email"
              value={invoiceEmailCc}
              onChange={(ev) => setInvoiceEmailCc(ev.target.value)}
              placeholder="controller@udgok.com"
              className="w-full px-3 py-2 border border-line text-[13px] font-mono"
            />
          </label>
        </div>
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
            Default payment terms
          </div>
          <input
            value={defaultTerms}
            onChange={(ev) => setDefaultTerms(ev.target.value)}
            placeholder="Net 30"
            className="w-full px-3 py-2 border border-line text-[13px] font-mono"
          />
        </label>
      </div>

      <div className="px-4 py-2 border-y-2 border-ink text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {'// Accepted payment methods'}
      </div>
      <div className="p-4 space-y-2">
        <label className="flex items-start gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={allowAch}
            onChange={(ev) => setAllowAch(ev.target.checked)}
            className="mt-1"
          />
          <span>
            <b>ACH on file</b>
            <div className="text-[11px] text-ink-50 mt-0.5">
              Vendor&apos;s bank details are stored on the vendor record. We pay via ACH.
            </div>
          </span>
        </label>
        {allowAch ? (
          <label className="block ml-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
              ACH instructions (shown to vendors)
            </div>
            <textarea
              value={achInstructions}
              onChange={(ev) => setAchInstructions(ev.target.value)}
              rows={2}
              placeholder="e.g. ACH routing 123456789, account 987654321"
              className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
            />
          </label>
        ) : null}
        <label className="flex items-start gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={allowCard}
            onChange={(ev) => setAllowCard(ev.target.checked)}
            className="mt-1"
          />
          <span>
            <b>Credit card on file</b>
            <div className="text-[11px] text-ink-50 mt-0.5">
              We charge the vendor&apos;s card on file for the invoice total.
            </div>
          </span>
        </label>
        <label className="flex items-start gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={allowCheck}
            onChange={(ev) => setAllowCheck(ev.target.checked)}
            className="mt-1"
          />
          <span>
            <b>Check by mail</b>
            <div className="text-[11px] text-ink-50 mt-0.5">
              Vendor mails a check. We show them the payable-to + mailing address.
            </div>
            {allowCheck ? (
              <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  value={checkPayableTo}
                  onChange={(ev) => setCheckPayableTo(ev.target.value)}
                  placeholder="Payable to: UDGOK Construction LLC"
                  className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
                />
                <input
                  value={checkMailTo}
                  onChange={(ev) => setCheckMailTo(ev.target.value)}
                  placeholder="Mail to: 123 Main St, Tulsa OK 74103"
                  className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
                />
              </div>
            ) : null}
          </span>
        </label>
        <label className="flex items-start gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={allowPaymentLink}
            onChange={(ev) => setAllowPaymentLink(ev.target.checked)}
            className="mt-1"
          />
          <span>
            <b>Send vendor a payment link</b>
            <div className="text-[11px] text-ink-50 mt-0.5">
              We email a Stripe checkout link. The vendor pays online, we&apos;re notified via webhook.
            </div>
            {allowPaymentLink ? (
              <div className="mt-1.5">
                <input
                  value={paymentLinkBaseUrl}
                  onChange={(ev) => setPaymentLinkBaseUrl(ev.target.value)}
                  placeholder="https://buy.stripe.com/udgok-…"
                  className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
                />
                <div className="text-[10px] text-ink-50 mt-1">
                  Stripe Checkout Session URL — generated per invoice by the action layer.
                </div>
              </div>
            ) : null}
          </span>
        </label>
      </div>

      <div className="px-4 py-3 border-t-2 border-ink flex justify-end items-center gap-3">
        {error ? <div className="text-[11px] text-error font-semibold">⚠ {error}</div> : null}
        {saved ? <div className="text-[11px] text-success font-semibold">✓ Saved</div> : null}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-4 py-2 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
