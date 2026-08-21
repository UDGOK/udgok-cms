'use client';

/**
 * Confirmation view — shown after the vendor submits a
 * response. Reads the response off the PO (latest
 * vendorResponseId) and shows a summary.
 *
 * If the vendor comes back to the same URL, we show this
 * view with their prior response — they can see their
 * submitted payment method + reference, but they can't
 * edit it (a new submission would be a different row).
 */

type SubmittedViewProps = {
  justSubmitted?: boolean;
  po: {
    id: string;
    number: string;
    vendorResponseId: string | null;
    paymentMethodChosen: 'ON_FILE' | 'PAYMENT_LINK' | 'INVOICE_BY_EMAIL' | 'CHECK' | null;
    paymentMethodDetail: string | null;
    vendorReference: string | null;
    acknowledgedAt: Date | null;
    status: string;
    vendor: { name: string };
    workspace: { name: string };
  };
};

const PAYMENT_LABEL: Record<string, string> = {
  ON_FILE: 'Payment on file',
  PAYMENT_LINK: 'Payment link requested',
  INVOICE_BY_EMAIL: 'Invoice by email',
  CHECK: 'Check',
};

export function PoSubmittedView({ justSubmitted, po }: SubmittedViewProps) {
  return (
    <main className="min-h-screen bg-cream py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-paper border-2 border-ink p-8">
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-50 mb-2">
            {'// '}{po.workspace.name}
          </div>
          <h1 className="text-2xl font-black mb-2">
            {justSubmitted ? 'Response received' : `PO ${po.number}`}
          </h1>
          {justSubmitted ? (
            <p className="text-[13px] text-ink-70 mb-6">
              Thanks. We&apos;ve recorded your response for {po.number}. The buyer will review and reach out if anything is needed.
            </p>
          ) : (
            <p className="text-[13px] text-ink-70 mb-6">
              You already submitted a response for this PO. Here&apos;s what we have on file:
            </p>
          )}

          <dl className="space-y-2 text-[12px] border-t border-line pt-4">
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">PO</dt>
              <dd className="col-span-2 font-mono">{po.number}</dd>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Vendor</dt>
              <dd className="col-span-2">{po.vendor.name}</dd>
            </div>
            {po.acknowledgedAt ? (
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Acknowledged</dt>
                <dd className="col-span-2 font-mono">{po.acknowledgedAt.toLocaleString()}</dd>
              </div>
            ) : null}
            {po.paymentMethodChosen ? (
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Payment</dt>
                <dd className="col-span-2 font-mono">
                  {PAYMENT_LABEL[po.paymentMethodChosen]}
                  {po.paymentMethodDetail ? ` — ${po.paymentMethodDetail}` : ''}
                </dd>
              </div>
            ) : null}
            {po.vendorReference ? (
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Your ref</dt>
                <dd className="col-span-2 font-mono">{po.vendorReference}</dd>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Status</dt>
              <dd className="col-span-2">
                <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em]">
                  {po.status}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-6 px-3 py-2 bg-cream-2 border border-line text-[11px] text-ink-70">
            Need to update your response? Reply to the email you received and we&apos;ll re-send a fresh link.
          </div>
        </div>
      </div>
    </main>
  );
}
