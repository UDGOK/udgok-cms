'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

interface VendorOption {
  id: string;
  name: string;
  contacts: { id: string; name: string; email: string; isPrimary: boolean }[];
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-50/15 text-ink-50',
  QUOTING: 'bg-info/15 text-info',
  QUOTED: 'bg-orange/15 text-orange',
  CLOSED: 'bg-success/15 text-success',
  SENT: 'bg-info/15 text-info',
  VIEWED: 'bg-info/15 text-info',
  RESPONDED: 'bg-orange/15 text-orange',
  ACCEPTED: 'bg-success/15 text-success',
  DECLINED: 'bg-error/15 text-error',
  CANCELLED: 'bg-ink-50/15 text-ink-50',
  EXPIRED: 'bg-error/15 text-error',
};

export function ListDetailView({
  workspaceId,
  workspaceSlug,
  list,
  vendors,
}: {
  workspaceId: string;
  workspaceSlug: string;
  list: ListDto;
  vendors: VendorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(list.lines.length === 0);
  const [showSend, setShowSend] = useState(false);

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
          {list.status !== 'CLOSED' && list.lines.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowSend(true)}
              className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
            >
              + Send to vendor
            </button>
          ) : null}
          {list.rfqs.length > 1 && list.status === 'QUOTED' ? (
            <Link
              href={`/w/${workspaceSlug}/procurement/compare?list=${list.id}`}
              className="px-3 py-2 bg-ink text-paper border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.12em]"
            >
              Compare quotes
            </Link>
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

      {/* RFQs list */}
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
                <Link
                  href={`/w/${workspaceSlug}/procurement/rfqs/${r.id}`}
                  className="font-extrabold flex-1 min-w-0 truncate hover:text-orange-d"
                >
                  {r.vendor.name}
                </Link>
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                    STATUS_COLOR[r.status] ?? 'bg-ink-50/15 text-ink-50'
                  }`}
                >
                  {r.status}
                </span>
                <span className="text-[10px] text-ink-50 font-mono w-24 text-right">
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

      {showSend ? (
        <SendRfqModal
          listId={list.id}
          listName={list.name}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          vendors={vendors}
          // Pass the actual RFQ info (not just vendor ids) so the
          // modal can show blocked vendors with a clear reason
          // ("already has a DRAFT — open it") instead of hiding
          // them silently. Was the source of the "where did
          // Jee Lighting go?" bug — see git history.
          existingRfqs={list.rfqs
            .filter((r) => ['DRAFT', 'SENT', 'VIEWED'].includes(r.status))
            .map((r) => ({ rfqId: r.id, number: r.number, status: r.status, vendorId: r.vendor.id }))}
          onClose={() => setShowSend(false)}
        />
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

export function SendRfqModal({
  listId,
  listName,
  workspaceId,
  workspaceSlug,
  vendors,
  existingRfqs,
  onClose,
}: {
  listId: string;
  listName: string;
  workspaceId: string;
  workspaceSlug: string;
  vendors: VendorOption[];
  // The RFQs that already exist for this list in an active
  // status. Vendors with one of these are shown in the dropdown
  // but disabled, with a "jump to existing" link so the user
  // can act on the draft (send, edit, void) instead of getting
  // confused that the vendor disappeared.
  existingRfqs: { rfqId: string; number: string; status: string; vendorId: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const blockedByVendor = new Map<string, { rfqId: string; number: string; status: string }>();
  for (const r of existingRfqs) {
    blockedByVendor.set(r.vendorId, { rfqId: r.rfqId, number: r.number, status: r.status });
  }
  const [vendorId, setVendorId] = useState(
    vendors.find((v) => !blockedByVendor.has(v.id))?.id ?? '',
  );
  const [contactId, setContactId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const availableContacts = selectedVendor?.contacts ?? [];
  const eligible = vendors.filter((v) => !blockedByVendor.has(v.id));
  const blocked = vendors.filter((v) => blockedByVendor.has(v.id));
  // If the user somehow has a blocked vendor selected (e.g. via
  // browser autofill), still show the "jump to existing" hint.
  const selectedBlocked = selectedVendor ? blockedByVendor.get(selectedVendor.id) : undefined;

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('listId', listId);
    fd.set('vendorId', vendorId);
    if (contactId) fd.set('contactId', contactId);
    if (message) fd.set('message', message);
    startTransition(async () => {
      // Dynamic import keeps the action out of the initial
      // client bundle; it ships as its own chunk.
      const { createRfqAction } = await import('@/lib/procurement/rfq-actions');
      const res = await createRfqAction(workspaceId, undefined, fd);
      if (res.ok) {
        if (res.magicLinkUrl) {
          // Email failed — show the link in a prompt so the
          // buyer can copy it manually before we close.
          prompt(
            `Saved as DRAFT — email not sent.\n\nReason: ${res.message}\n\nMagic link (copy this to the vendor):`,
            res.magicLinkUrl,
          );
        }
        router.push(`/w/${workspaceSlug}/procurement/rfqs/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={send}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border-2 border-ink w-full max-w-lg p-6"
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
          {'// SEND TO VENDOR'}
        </div>
        <h2 className="text-xl font-black mb-1">{listName}</h2>
        <p className="text-[12px] text-ink-70 mb-4">
          We&apos;ll email a private magic link to the vendor. They open it, type in their
          prices, and you get a quote back here.
        </p>

        {eligible.length === 0 ? (
          <div className="bg-warning/10 border border-warning p-2 text-[12px] text-warning mb-3">
            All your active vendors already have an open RFQ for this list. Use &quot;Resend&quot;
            on the existing RFQ page to rotate the link, or add a new vendor.
          </div>
        ) : (
          <>
            <label className="block mb-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
                Vendor
              </div>
              <select
                required
                value={vendorId}
                onChange={(e) => {
                  setVendorId(e.target.value);
                  setContactId('');
                }}
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
              >
                <option value="">— pick a vendor —</option>
                {eligible.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.contacts.length} contact{v.contacts.length === 1 ? '' : 's'})
                  </option>
                ))}
                {blocked.length > 0 ? (
                  <optgroup label="— already has an open RFQ on this list —">
                    {blocked.map((v) => {
                      const blocker = blockedByVendor.get(v.id)!;
                      return (
                        <option key={v.id} value={v.id} disabled>
                          {v.name} — {blocker.status} {blocker.number}
                        </option>
                      );
                    })}
                  </optgroup>
                ) : null}
              </select>
              {selectedBlocked ? (
                <div className="mt-2 p-2 bg-warning/10 border border-warning text-[11px] text-ink">
                  <strong>Already has a {selectedBlocked.status} RFQ on this list.</strong>{' '}
                  <a
                    href={`/w/${workspaceSlug}/procurement/rfqs/${selectedBlocked.rfqId}`}
                    className="underline font-semibold"
                  >
                    Open {selectedBlocked.number} →
                  </a>{' '}
                  to send, edit, or void it.
                </div>
              ) : null}
            </label>

            {availableContacts.length > 0 ? (
              <label className="block mb-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
                  Send to (defaults to primary)
                </div>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
                >
                  <option value="">
                    {availableContacts.find((c) => c.isPrimary)
                      ? `— primary (${availableContacts.find((c) => c.isPrimary)?.name}) —`
                      : '— pick a contact —'}
                  </option>
                  {availableContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isPrimary ? '(primary)' : ''} — {c.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block mb-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
                Message to vendor (optional)
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="Job context, what they need to know, how to reach us…"
                className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm resize-none"
              />
            </label>
          </>
        )}

        {error ? (
          <div className="bg-error/10 border border-error p-2 text-[12px] text-error font-semibold mb-3">
            ⚠ {error}
          </div>
        ) : null}

        <div className="flex gap-2 justify-end pt-2 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 border border-line text-[11px] font-extrabold uppercase tracking-[0.12em]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !vendorId || availableContacts.length === 0}
            className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'Send RFQ'}
          </button>
        </div>
      </form>
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
