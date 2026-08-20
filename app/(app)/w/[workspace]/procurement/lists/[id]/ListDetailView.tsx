'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addListLineAction, archiveListAction, deleteListLineAction } from '@/lib/procurement/list-actions';
import { UOMS } from '@/lib/procurement/types';

interface LineDto {
  id: string;
  position: number;
  description: string;
  manufacturer: string | null;
  mfrPartNumber: string | null;
  quantity: number;
  uom: string;
  notes: string | null;
  item: { id: string; description: string; sku: string | null } | null;
}

interface RfqDto {
  id: string;
  number: string;
  status: string;
  vendor: { id: string; name: string };
  sentAt: string | null;
  respondedAt: string | null;
}

interface ListDto {
  id: string;
  name: string;
  status: string;
  neededBy: string | null;
  deliverTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: LineDto[];
  rfqs: RfqDto[];
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-50/15 text-ink-50',
  QUOTING: 'bg-info/15 text-info',
  QUOTED: 'bg-orange/15 text-orange',
  CLOSED: 'bg-success/15 text-success',
};

export function ListDetailView({
  workspaceId,
  workspaceSlug,
  list,
}: {
  workspaceId: string;
  workspaceSlug: string;
  list: ListDto;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(list.lines.length === 0);

  function deleteLine(lineId: string) {
    if (!confirm('Delete this line?')) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteListLineAction(workspaceId, list.id, lineId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function archive() {
    if (!confirm(`Archive "${list.name}"? The lines are kept but the list is hidden.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await archiveListAction(workspaceId, list.id);
      if (res.ok) router.push(`/w/${workspaceSlug}/procurement/lists`);
      else setError(res.error);
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mt-2 mb-4">
        <div>
          <h1 className="text-2xl font-black">{list.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                STATUS_COLOR[list.status] ?? 'bg-ink-50/15 text-ink-50'
              }`}
            >
              {list.status}
            </span>
            {list.neededBy ? (
              <span className="text-[10px] text-ink-50 font-mono">
                Needed by {new Date(list.neededBy).toLocaleDateString()}
              </span>
            ) : null}
            {list.deliverTo ? (
              <span className="text-[10px] text-ink-50 font-mono">
                Deliver to {list.deliverTo}
              </span>
            ) : null}
            <span className="text-[10px] text-ink-50 font-mono">
              {list.lines.length} line{list.lines.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {list.status === 'DRAFT' && list.lines.length > 0 ? (
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-info bg-info/10 px-2 py-1">
              Phase 2: Request quotes →
            </span>
          ) : null}
          <button
            type="button"
            onClick={archive}
            disabled={pending}
            className="px-3 py-2 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
          >
            Archive
          </button>
        </div>
      </div>

      {list.notes ? (
        <div className="bg-cream-2 border border-line p-3 mb-4 text-[12px] text-ink-70 whitespace-pre-wrap">
          {list.notes}
        </div>
      ) : null}

      {/* RFQs list (Phase 2 will have a "Send to vendor" action here) */}
      {list.rfqs.length > 0 ? (
        <div className="bg-paper border-2 border-ink mb-4 p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            {'// RFQs on this list'}
          </div>
          <ul className="divide-y divide-line">
            {list.rfqs.map((r) => (
              <li
                key={r.id}
                className="py-2 first:pt-0 last:pb-0 flex items-center gap-3 text-[12px]"
              >
                <span className="font-mono text-[10px] text-ink-50 w-24">{r.number}</span>
                <span className="font-extrabold flex-1 min-w-0 truncate">{r.vendor.name}</span>
                <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em]">
                  {r.status}
                </span>
                <span className="text-[10px] text-ink-50 font-mono w-20 text-right">
                  {r.respondedAt
                    ? `Replied ${new Date(r.respondedAt).toLocaleDateString()}`
                    : r.sentAt
                    ? `Sent ${new Date(r.sentAt).toLocaleDateString()}`
                    : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Line items table */}
      <div className="bg-paper border-2 border-ink overflow-x-auto mb-4">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-ink text-cream">
              <th className="text-left px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] w-8">#</th>
              <th className="text-left px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                Description
              </th>
              <th className="text-right px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] w-20">
                Qty
              </th>
              <th className="text-left px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] w-16">
                UoM
              </th>
              <th className="text-left px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                Mfr
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {list.lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-ink-50">
                  No lines yet. Add the first one below.
                </td>
              </tr>
            ) : (
              list.lines.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-b-0">
                  <td className="px-2 py-2 font-mono text-[10px] text-ink-50">{l.position}</td>
                  <td className="px-2 py-2">
                    <div className="font-extrabold">{l.description}</div>
                    {l.item ? (
                      <div className="text-[10px] text-info">
                        ↪ {l.item.description}
                        {l.item.sku ? ` (SKU ${l.item.sku})` : ''}
                      </div>
                    ) : null}
                    {l.notes ? (
                      <div className="text-[10px] text-ink-50 mt-0.5">{l.notes}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{l.quantity.toLocaleString()}</td>
                  <td className="px-2 py-2 font-mono text-[10px] text-ink-70">{l.uom}</td>
                  <td className="px-2 py-2 text-[10px] text-ink-50 font-mono">
                    {l.manufacturer ? <div>{l.manufacturer}</div> : null}
                    {l.mfrPartNumber ? <div>{l.mfrPartNumber}</div> : null}
                    {!l.manufacturer && !l.mfrPartNumber ? '—' : null}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteLine(l.id)}
                      disabled={pending}
                      className="text-[10px] font-mono uppercase tracking-[0.1em] text-error hover:underline disabled:opacity-50"
                    >
                      delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <AddLineForm
          workspaceId={workspaceId}
          listId={list.id}
          onClose={() => setAdding(false)}
          onAdded={() => {
            router.refresh();
            if (list.lines.length > 0) setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="px-3 py-2 bg-cream border border-line text-[11px] font-extrabold uppercase tracking-[0.12em] hover:border-ink"
        >
          + Add line
        </button>
      )}

      {error ? (
        <div className="mt-3 text-[12px] text-error font-semibold">⚠ {error}</div>
      ) : null}
    </div>
  );
}

function AddLineForm({
  workspaceId,
  listId,
  onClose,
  onAdded,
}: {
  workspaceId: string;
  listId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [uom, setUom] = useState('EA');
  const [manufacturer, setManufacturer] = useState('');
  const [mfrPartNumber, setMfrPartNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('description', description);
      fd.set('quantity', quantity);
      fd.set('uom', uom);
      if (manufacturer) fd.set('manufacturer', manufacturer);
      if (mfrPartNumber) fd.set('mfrPartNumber', mfrPartNumber);
      if (notes) fd.set('notes', notes);
      const res = await addListLineAction(workspaceId, listId, undefined, fd);
      if (res.ok) {
        setDescription('');
        setQuantity('1');
        setUom('EA');
        setManufacturer('');
        setMfrPartNumber('');
        setNotes('');
        onAdded();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-cream-2 border-2 border-line p-3 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        Add line (free-text — material list lines don&apos;t require an item catalog entry)
      </div>
      <div className="grid grid-cols-12 gap-2">
        <input
          type="text"
          required
          maxLength={500}
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (e.g. 12/2 Romex wire, 250ft roll)"
          className="col-span-12 md:col-span-6 px-2 py-1.5 bg-paper border border-line text-ink text-[12px]"
        />
        <input
          type="number"
          required
          min="0"
          step="0.0001"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="col-span-4 md:col-span-2 px-2 py-1.5 bg-paper border border-line text-ink text-[12px] font-mono text-right"
        />
        <select
          value={uom}
          onChange={(e) => setUom(e.target.value)}
          className="col-span-4 md:col-span-1 px-2 py-1.5 bg-paper border border-line text-ink text-[11px] font-mono"
        >
          {UOMS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          placeholder="Mfr (optional)"
          className="col-span-4 md:col-span-3 px-2 py-1.5 bg-paper border border-line text-ink text-[11px]"
        />
        <input
          type="text"
          value={mfrPartNumber}
          onChange={(e) => setMfrPartNumber(e.target.value)}
          placeholder="Mfr# (optional)"
          className="col-span-12 md:col-span-12 px-2 py-1.5 bg-paper border border-line text-ink text-[11px] font-mono"
        />
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional, e.g. colour, gauge, etc.)"
        className="w-full px-2 py-1.5 bg-paper border border-line text-ink text-[11px]"
      />
      {error ? <div className="text-[11px] text-error font-semibold">⚠ {error}</div> : null}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 border border-line text-[11px] font-extrabold uppercase tracking-[0.12em]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !description}
          className="px-3 py-1.5 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] disabled:opacity-50"
        >
          {pending ? 'Adding…' : '+ Add line'}
        </button>
      </div>
    </form>
  );
}
