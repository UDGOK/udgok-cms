'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { issuePoAction, cancelPoAction, resendPoEmailAction } from '@/lib/procurement/po-actions';
import { PoEditor } from './PoEditor';

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
  // Delivery block (separate from shipTo) — where the
  // driver physically drops off + on-site point of contact
  deliveryName: string | null;
  deliveryAddress: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryContactEmail: string | null;
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
  // Activity log — most recent 50 events. Append-only,
  // records every meaningful change to the PO so the buyer
  // has an audit trail without diffing the line table.
  events: Array<{
    id: string;
    type: string;
    actor: string | null;
    createdAt: string;
    meta: unknown;
  }>;
}

export function PoDetailView({
  po,
  workspaceId,
  workspaceSlug,
}: {
  po: PoDto;
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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

  function resend() {
    if (!confirm(`Re-send the PO email for ${po.number} to ${po.vendor.name}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await resendPoEmailAction(workspaceId, po.id);
      if (res.ok) {
        alert(`Re-sent ${po.number} to the vendor's contact email.`);
        router.refresh();
      } else {
        setError(res.error);
      }
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
          <a
            href={`/w/${workspaceSlug}/procurement/pos/${po.id}/pdf`}
            target="_blank"
            rel="noopener"
            className="px-3 py-2 border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper"
          >
            ↓ Download PDF
          </a>
          {po.status !== 'DRAFT' && po.status !== 'PENDING_APPROVAL' && po.status !== 'CANCELLED' ? (
            <button
              type="button"
              onClick={resend}
              disabled={pending}
              className="px-3 py-2 border-2 border-info text-info text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-info/10 disabled:opacity-50"
              title="Re-send the PO email to the vendor's contact"
            >
              {pending ? 'Sending…' : '↻ Resend email'}
            </button>
          ) : null}
          {po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT' ? (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={`px-3 py-2 border-2 text-[11px] font-extrabold uppercase tracking-[0.12em] ${
                editing
                  ? 'bg-ink text-paper border-ink'
                  : 'border-ink hover:bg-ink hover:text-paper'
              }`}
            >
              {editing ? 'Close editor' : 'Edit PO'}
            </button>
          ) : null}
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

      {/* Delivery block — only show if any delivery field is set.
          Distinct from shipTo because the delivery address is
          often a jobsite, not the buyer's office, and the
          vendor's driver needs the on-site point of contact. */}
      {po.deliveryAddress || po.deliveryName || po.deliveryContactName ? (
        <div className="bg-info/5 border border-info p-3 mb-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-info mb-2">
            {'// Delivery — driver drop-off + on-site point of contact'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                Site / location
              </div>
              <div className="text-ink font-semibold">{po.deliveryName ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                Address
              </div>
              <div className="text-ink whitespace-pre-wrap">{po.deliveryAddress ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
                On-site point of contact
              </div>
              <div className="text-ink">
                {po.deliveryContactName ?? '—'}
                {po.deliveryContactPhone ? (
                  <span className="text-ink-70"> · {po.deliveryContactPhone}</span>
                ) : null}
                {po.deliveryContactEmail ? (
                  <span className="text-ink-70"> · {po.deliveryContactEmail}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="mb-4">
          <PoEditor
            workspaceId={workspaceId}
            poId={po.id}
            status={po.status}
            initialLines={po.lines.map((l) => ({
              id: l.id,
              description: l.description,
              quantity: l.quantity,
              uom: l.uom,
              vendorSku: l.vendorSku,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
              notes: l.notes,
            }))}
            initialShipTo={po.shipTo}
            initialTerms={po.terms}
            initialNotes={po.notes}
            initialFreight={po.freightAmount}
            initialTax={po.taxAmount}
            initialDeliveryName={po.deliveryName}
            initialDeliveryAddress={po.deliveryAddress}
            initialDeliveryContactName={po.deliveryContactName}
            initialDeliveryContactPhone={po.deliveryContactPhone}
            initialDeliveryContactEmail={po.deliveryContactEmail}
          />
        </div>
      ) : null}

      {!editing ? (
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
      ) : null}

      {po.notes ? (
        <div className="bg-cream-2 border border-line p-3 text-[12px] text-ink-70 whitespace-pre-wrap">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Notes
          </div>
          {po.notes}
        </div>
      ) : null}

      {/* Activity log — every meaningful change to the PO.
          Append-only audit trail; the buyer can see who
          edited the PO, when, and what they changed (added
          / removed / modified line counts from the EDITED
          event's meta). */}
      {po.events.length > 0 ? (
        <div className="mt-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            {'// Activity log'}
          </div>
          <div className="border border-line bg-paper">
            {po.events.map((e, i) => {
              const meta = (e.meta ?? {}) as {
                added?: string[];
                removed?: string[];
                modified?: string[];
                newTotal?: number;
                newSubtotal?: number;
              };
              const lineDelta =
                meta.added?.length || meta.removed?.length || meta.modified?.length
                  ? `+${meta.added?.length ?? 0} / −${meta.removed?.length ?? 0} / ~${meta.modified?.length ?? 0}`
                  : null;
              return (
                <div
                  key={e.id}
                  className={`px-3 py-2 text-[12px] flex items-start gap-3 ${
                    i > 0 ? 'border-t border-line' : ''
                  }`}
                >
                  <span className="text-[10px] font-mono text-ink-50 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                  <span className="font-extrabold text-ink-50 uppercase tracking-[0.1em] text-[10px] whitespace-nowrap w-[60px]">
                    {e.type}
                  </span>
                  <span className="text-ink-70 flex-1">
                    {e.type === 'EDITED' && lineDelta
                      ? `lines: ${lineDelta}`
                      : e.type === 'ISSUED'
                      ? 'PO issued and emailed to vendor'
                      : e.type === 'RESENT'
                      ? 'PO email re-sent to vendor'
                      : e.type === 'CREATED'
                      ? 'PO created from accepted quote'
                      : e.type === 'CANCELLED'
                      ? 'PO cancelled'
                      : '—'}
                    {meta.newTotal != null ? (
                      <span className="font-mono text-ink-50 ml-2">
                        total ${meta.newTotal.toFixed(2)}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px] font-mono text-ink-50">
                    {e.actor ? e.actor.slice(-6) : 'system'}
                  </span>
                </div>
              );
            })}
          </div>
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
