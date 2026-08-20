'use client';

/**
 * PoEditor — inline editor for a PO that's in PENDING_APPROVAL
 * (or DRAFT). Adds/removes/edits lines, recomputes money on the
 * server. Submitting the editor replaces ALL lines (the
 * server diff handles adds/edits/deletes atomically).
 *
 * Replaces the read-only line table on the detail page when
 * the user clicks "Edit PO". On save, the parent re-renders
 * with the new server state.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { editPoAction } from '@/lib/procurement/po-edit-actions';

interface EditorLine {
  id: string; // existing line id, or `new_<i>` for not-yet-saved
  description: string;
  quantity: string;
  unitPrice: string;
  uom: string;
  vendorSku: string;
  notes: string;
  // Tracks whether this is a brand-new line in this edit session
  isNew: boolean;
}

interface Props {
  workspaceId: string;
  poId: string;
  status: string;
  initialLines: Array<{
    id: string;
    description: string;
    quantity: number;
    uom: string;
    vendorSku: string | null;
    unitPrice: number | null;
    lineTotal: number | null;
    notes: string | null;
  }>;
  initialShipTo: string | null;
  initialTerms: string | null;
  initialNotes: string | null;
  initialFreight: number;
  initialTax: number;
}

const STATUS_EDITABLE = new Set(['PENDING_APPROVAL', 'DRAFT']);

export function PoEditor(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editable = STATUS_EDITABLE.has(props.status);

  const [shipTo, setShipTo] = useState(props.initialShipTo ?? '');
  const [terms, setTerms] = useState(props.initialTerms ?? '');
  const [notes, setNotes] = useState(props.initialNotes ?? '');
  const [freight, setFreight] = useState(String(props.initialFreight));
  const [tax, setTax] = useState(String(props.initialTax));

  const [lines, setLines] = useState<EditorLine[]>(() =>
    props.initialLines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: String(l.quantity),
      unitPrice: l.unitPrice != null ? String(l.unitPrice) : '',
      uom: l.uom,
      vendorSku: l.vendorSku ?? '',
      notes: l.notes ?? '',
      isNew: false,
    })),
  );

  if (!editable) return null;

  function updateLine(id: string, patch: Partial<EditorLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: `new_${prev.length}_${Date.now()}`,
        description: '',
        quantity: '1',
        unitPrice: '',
        uom: 'EA',
        vendorSku: '',
        notes: '',
        isNew: true,
      },
    ]);
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const computed = computeTotals(lines, freight, tax);

  function save() {
    setError(null);
    const payload = {
      poId: props.poId,
      shipTo: shipTo || null,
      terms: terms || null,
      notes: notes || null,
      freightAmount: Number(freight) || 0,
      taxAmount: Number(tax) || 0,
      lines: lines.map((l) => ({
        // New lines have id starting with `new_` — strip
        // the id when sending so the server treats them
        // as creates.
        id: l.isNew ? undefined : l.id,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice || 0,
        uom: l.uom,
        vendorSku: l.vendorSku || null,
        notes: l.notes || null,
      })),
    };
    startTransition(async () => {
      const fd = new FormData();
      fd.set('payload', JSON.stringify(payload));
      const res = await editPoAction(props.workspaceId, undefined, fd);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="bg-paper border-2 border-ink p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {'// Editing PO'}
        </div>
        <div className="text-[10px] text-ink-50 font-mono">
          {lines.length} line{lines.length === 1 ? '' : 's'} · server recomputes money on save
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <Field label="Ship to">
          <input
            type="text"
            value={shipTo}
            onChange={(e) => setShipTo(e.target.value)}
            className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
          />
        </Field>
        <Field label="Terms">
          <input
            type="text"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
          />
        </Field>
        <Field label="Notes">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
          />
        </Field>
      </div>

      <div className="space-y-2 mb-3">
        {lines.map((l) => (
          <div key={l.id} className="border border-line p-2 bg-cream-2">
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="Description"
                value={l.description}
                onChange={(e) => updateLine(l.id, { description: e.target.value })}
                className="col-span-12 md:col-span-5 px-2 py-1.5 bg-paper border border-line text-ink text-[12px]"
              />
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="Qty"
                value={l.quantity}
                onChange={(e) => updateLine(l.id, { quantity: e.target.value })}
                className="col-span-4 md:col-span-2 px-2 py-1.5 bg-paper border border-line text-ink text-[12px] font-mono text-right"
              />
              <input
                type="text"
                placeholder="UoM"
                value={l.uom}
                onChange={(e) => updateLine(l.id, { uom: e.target.value })}
                className="col-span-3 md:col-span-1 px-2 py-1.5 bg-paper border border-line text-ink text-[12px] font-mono"
              />
              <input
                type="text"
                placeholder="SKU"
                value={l.vendorSku}
                onChange={(e) => updateLine(l.id, { vendorSku: e.target.value })}
                className="col-span-5 md:col-span-2 px-2 py-1.5 bg-paper border border-line text-ink text-[12px] font-mono"
              />
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="Unit $"
                value={l.unitPrice}
                onChange={(e) => updateLine(l.id, { unitPrice: e.target.value })}
                className="col-span-6 md:col-span-1 px-2 py-1.5 bg-paper border border-line text-ink text-[12px] font-mono text-right"
              />
              <button
                type="button"
                onClick={() => removeLine(l.id)}
                className="col-span-2 md:col-span-1 px-2 py-1.5 text-error text-[10px] font-extrabold uppercase tracking-[0.1em] hover:bg-error/10"
                title="Remove line"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={addLine}
          className="px-3 py-1.5 bg-cream border border-line text-[11px] font-extrabold uppercase tracking-[0.12em] hover:border-ink"
        >
          + Add line
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-[12px]">
        <div>
          <LabelSm>Subtotal</LabelSm>
          <div className="font-mono text-right">${computed.subtotal.toFixed(2)}</div>
        </div>
        <div>
          <LabelSm>Freight</LabelSm>
          <input
            type="number"
            step="0.01"
            min="0"
            value={freight}
            onChange={(e) => setFreight(e.target.value)}
            className="w-full px-2 py-1 bg-cream border border-line text-ink text-[12px] font-mono text-right"
          />
        </div>
        <div>
          <LabelSm>Tax</LabelSm>
          <input
            type="number"
            step="0.01"
            min="0"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            className="w-full px-2 py-1 bg-cream border border-line text-ink text-[12px] font-mono text-right"
          />
        </div>
        <div>
          <LabelSm>Total</LabelSm>
          <div className="font-mono text-right font-extrabold">${computed.total.toFixed(2)}</div>
        </div>
      </div>

      {error ? (
        <div className="bg-error/10 border border-error p-2 text-[12px] text-error font-semibold mb-3">
          ⚠ {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={save}
          disabled={pending || lines.length === 0}
          className="px-4 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

function LabelSm({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">
      {children}
    </div>
  );
}

function computeTotals(
  lines: EditorLine[],
  freight: string,
  tax: string,
) {
  let subtotal = 0;
  for (const l of lines) {
    const q = Number(l.quantity) || 0;
    const p = Number(l.unitPrice) || 0;
    if (Number.isFinite(q) && Number.isFinite(p)) subtotal += q * p;
  }
  const f = Number(freight) || 0;
  const t = Number(tax) || 0;
  return { subtotal, freight: f, tax: t, total: subtotal + f + t };
}
