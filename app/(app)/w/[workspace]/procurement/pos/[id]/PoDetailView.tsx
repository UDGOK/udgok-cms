'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { issuePoAction, cancelPoAction } from '@/lib/procurement/po-actions';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-50/15 text-ink-50',
  PENDING_APPROVAL: 'bg-warning/15 text-warning',
  ISSUED: 'bg-info/15 text-info',
  ACKNOWLEDGED: 'bg-info/15 text-info',
  RECEIVED: 'bg-success/15 text-success',
  CLOSED: 'bg-success/15 text-success',
  CANCELLED: 'bg-ink-50/15 text-ink-50',
};

interface PoDto {
  id: string;
  number: string;
  status: string;
  vendor: { id: string; name: string };
  quote: { id: string; revision: number; vendorReference: string | null } | null;
  subtotal: number;
  freightAmount: number;
  taxAmount: number;
  total: number;
  terms: string | null;
  shipTo: string | null;
  notes: string | null;
  issuedAt: string | null;
  issuedBy: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    position: number;
    description: string;
    quantity: number;
    uom: string;
    vendorSku: string | null;
    unitPrice: number | null;
    lineTotal: number | null;
    isSubstitute: boolean;
    substituteNote: string | null;
    notes: string | null;
  }>;
}

export function PoDetailView({
  po,
  workspaceId,
}: {
  po: PoDto;
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function issue() {
    if (!confirm(`Issue ${po.number}? It becomes a binding commitment to ${po.vendor.name}.`)) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('poId', po.id);
      const res = await issuePoAction(workspaceId, undefined, fd);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function cancel() {
    if (!confirm(`Cancel ${po.number}? This is reversible only by recreating.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelPoAction(workspaceId, po.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mt-2 mb-4">
        <div>
          <h1 className="text-2xl font-black">{po.number}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                STATUS_COLOR[po.status] ?? 'bg-ink-50/15 text-ink-50'
              }`}
            >
              {po.status}
            </span>
            <span className="text-[11px] text-ink-70">→ {po.vendor.name}</span>
            {po.quote ? (
              <span className="text-[10px] text-ink-50 font-mono">
                from quote rev {po.quote.revision}
                {po.quote.vendorReference ? ` (#${po.quote.vendorReference})` : ''}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {po.status === 'PENDING_APPROVAL' ? (
            <>
              <button
                type="button"
                onClick={issue}
                disabled={pending}
                className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
              >
                {pending ? 'Issuing…' : 'Issue PO'}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="px-3 py-2 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="bg-error/10 border border-error p-2 mb-3 text-[12px] text-error font-semibold">
          ⚠ {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Field label="Ship to" value={po.shipTo ?? '—'} />
        <Field label="Terms" value={po.terms ?? '—'} />
        <Field label="Issued" value={po.issuedAt ? new Date(po.issuedAt).toLocaleString() : '—'} />
      </div>

      <div className="bg-paper border-2 border-ink overflow-x-auto mb-4">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-ink text-cream">
              <th className="text-left px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                Line
              </th>
              <th className="text-right px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] w-20">
                Qty
              </th>
              <th className="text-left px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] w-16">
                UoM
              </th>
              <th className="text-left px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                SKU
              </th>
              <th className="text-right px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                Unit
              </th>
              <th className="text-right px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-b-0">
                <td className="px-2 py-2">
                  <div className="font-extrabold">{l.description}</div>
                  {l.isSubstitute ? (
                    <div className="text-[10px] text-warning">
                      ↪ substitute: {l.substituteNote ?? '(no note)'}
                    </div>
                  ) : null}
                  {l.notes ? <div className="text-[10px] text-ink-50">{l.notes}</div> : null}
                </td>
                <td className="px-2 py-2 text-right font-mono">{l.quantity.toLocaleString()}</td>
                <td className="px-2 py-2 font-mono text-[10px]">{l.uom}</td>
                <td className="px-2 py-2 font-mono text-[10px]">{l.vendorSku ?? '—'}</td>
                <td className="px-2 py-2 text-right font-mono">
                  {l.unitPrice != null ? `$${l.unitPrice.toFixed(4)}` : '—'}
                </td>
                <td className="px-2 py-2 text-right font-mono font-extrabold">
                  {l.lineTotal != null ? `$${l.lineTotal.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase text-ink-50">
                Subtotal
              </td>
              <td className="px-2 py-1.5 text-right font-mono">${po.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase text-ink-50">
                Freight
              </td>
              <td className="px-2 py-1.5 text-right font-mono">${po.freightAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase text-ink-50">
                Tax
              </td>
              <td className="px-2 py-1.5 text-right font-mono">${po.taxAmount.toFixed(2)}</td>
            </tr>
            <tr className="bg-cream-2">
              <td colSpan={5} className="px-2 py-2 text-right text-[11px] font-extrabold uppercase tracking-[0.1em]">
                Total
              </td>
              <td className="px-2 py-2 text-right font-mono font-extrabold text-[14px]">
                ${po.total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {po.notes ? (
        <div className="bg-cream-2 border border-line p-3 text-[12px] text-ink-70 whitespace-pre-wrap">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Notes
          </div>
          {po.notes}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper border-2 border-ink p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {`// ${label}`}
      </div>
      <div className="text-[12px] mt-1">{value}</div>
    </div>
  );
}
