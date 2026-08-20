'use client';

/**
 * QuoteForm — vendor-facing price entry.
 *
 * Per spec §7.2 and §7.4:
 *   - One row per material list line.
 *   - Per line: unit price, available toggle, lead time,
 *     vendor SKU, substitute note, notes.
 *   - Top-level: respondent name/email, vendor reference #,
 *     lead time, terms, freight, tax.
 *   - "Decline" alternative to "Submit".
 *   - Idempotency key generated client-side (UUID v4) so a
 *     network retry doesn't create a duplicate quote.
 *   - Server recomputes line totals + grand totals; we never
 *     trust client math (spec §9.10).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface PortalLine {
  id: string;
  position: number;
  description: string;
  manufacturer: string | null;
  mfrPartNumber: string | null;
  quantity: number;
  uom: string;
}

export interface ExistingQuote {
  id: string;
  revision: number;
  respondentName: string | null;
  respondentEmail: string | null;
  vendorReference: string | null;
  leadTimeDays: number | null;
  terms: string | null;
  taxAmount: number;
  freightAmount: number;
  lines: Array<{
    id: string;
    listLineId: string | null;
    unitPrice: number | null;
    available: boolean;
    leadTimeDays: number | null;
    isSubstitute: boolean;
    substituteNote: string | null;
    vendorSku: string | null;
    notes: string | null;
  }>;
}

function uuid(): string {
  // Browser + Node 19+. crypto.randomUUID is available
  // everywhere we ship.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for ancient browsers; not strictly required
  // since we ship modern targets.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function QuoteForm({
  token,
  lines,
  existing,
  vendorName,
}: {
  token: string;
  lines: PortalLine[];
  existing: ExistingQuote | null;
  vendorName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [declineOpen, setDeclineOpen] = useState(false);

  // Build initial per-line state from the existing quote (if any)
  // or zeroed out. Keys are MaterialListLine.id.
  const [lineState, setLineState] = useState<Record<string, LineState>>(() => {
    const out: Record<string, LineState> = {};
    for (const l of lines) {
      const prev = existing?.lines.find((el) => el.listLineId === l.id);
      out[l.id] = {
        unitPrice: prev?.unitPrice != null ? String(prev.unitPrice) : '',
        available: prev?.available ?? true,
        leadTimeDays: prev?.leadTimeDays != null ? String(prev.leadTimeDays) : '',
        vendorSku: prev?.vendorSku ?? '',
        isSubstitute: prev?.isSubstitute ?? false,
        substituteNote: prev?.substituteNote ?? '',
        notes: prev?.notes ?? '',
      };
    }
    return out;
  });

  const [meta, setMeta] = useState({
    respondentName: existing?.respondentName ?? '',
    respondentEmail: existing?.respondentEmail ?? '',
    vendorReference: existing?.vendorReference ?? '',
    leadTimeDays: existing?.leadTimeDays != null ? String(existing.leadTimeDays) : '',
    terms: existing?.terms ?? 'Net 30',
    freightAmount: existing?.freightAmount ? String(existing.freightAmount) : '0',
    taxAmount: existing?.taxAmount ? String(existing.taxAmount) : '0',
  });
  const [declineReason, setDeclineReason] = useState('');

  function setLine(id: string, patch: Partial<LineState>) {
    setLineState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  // Computed totals, server will recompute. Display only.
  const computed = computeTotals(lines, lineState, meta);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const idempotencyKey = uuid();
    const payload = {
      action: 'SUBMIT' as const,
      idempotencyKey,
      respondentName: meta.respondentName,
      respondentEmail: meta.respondentEmail,
      vendorReference: meta.vendorReference || undefined,
      leadTimeDays: meta.leadTimeDays ? Number(meta.leadTimeDays) : undefined,
      terms: meta.terms || undefined,
      freightAmount: Number(meta.freightAmount) || 0,
      taxAmount: Number(meta.taxAmount) || 0,
      lines: lines.map((l) => {
        const s = lineState[l.id];
        return {
          listLineId: l.id,
          unitPrice: s.unitPrice ? Number(s.unitPrice) : undefined,
          available: s.available,
          leadTimeDays: s.leadTimeDays ? Number(s.leadTimeDays) : undefined,
          vendorSku: s.vendorSku || undefined,
          isSubstitute: s.isSubstitute,
          substituteNote: s.isSubstitute ? s.substituteNote || undefined : undefined,
          notes: s.notes || undefined,
        };
      }),
    };
    startTransition(async () => {
      const res = await fetch(`/api/q/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Submission failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { redirect: string };
      router.push(data.redirect);
    });
  }

  function decline(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/q/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DECLINE',
          idempotencyKey: uuid(),
          respondentName: meta.respondentName,
          respondentEmail: meta.respondentEmail,
          declineReason: declineReason || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Decline failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { redirect: string };
      router.push(data.redirect);
    });
  }

  return (
    <form onSubmit={submit} className="bg-paper border-2 border-ink p-5 space-y-4">
      {existing ? (
        <div className="bg-info/10 border border-info p-2 text-[12px] text-info">
          Editing your previous quote (revision {existing.revision}). Submitting creates revision{' '}
          {existing.revision + 1}.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Your name *">
          <input
            type="text"
            required
            maxLength={120}
            value={meta.respondentName}
            onChange={(e) => setMeta((m) => ({ ...m, respondentName: e.target.value }))}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
          />
        </Field>
        <Field label="Your email *">
          <input
            type="email"
            required
            maxLength={200}
            value={meta.respondentEmail}
            onChange={(e) => setMeta((m) => ({ ...m, respondentEmail: e.target.value }))}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono"
          />
        </Field>
        <Field label="Vendor reference / quote #">
          <input
            type="text"
            maxLength={80}
            value={meta.vendorReference}
            onChange={(e) => setMeta((m) => ({ ...m, vendorReference: e.target.value }))}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono"
          />
        </Field>
        <Field label="Lead time (days)">
          <input
            type="number"
            min="0"
            max="999"
            value={meta.leadTimeDays}
            onChange={(e) => setMeta((m) => ({ ...m, leadTimeDays: e.target.value }))}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono text-right"
          />
        </Field>
        <Field label="Terms">
          <input
            type="text"
            maxLength={200}
            value={meta.terms}
            onChange={(e) => setMeta((m) => ({ ...m, terms: e.target.value }))}
            placeholder="Net 30"
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm"
          />
        </Field>
        <Field label="Freight ($)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={meta.freightAmount}
            onChange={(e) => setMeta((m) => ({ ...m, freightAmount: e.target.value }))}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono text-right"
          />
        </Field>
        <Field label="Tax ($)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={meta.taxAmount}
            onChange={(e) => setMeta((m) => ({ ...m, taxAmount: e.target.value }))}
            className="w-full px-3 py-2 bg-cream border border-line text-ink text-sm font-mono text-right"
          />
        </Field>
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
          Line items
        </div>
        <div className="space-y-3">
          {lines.map((l) => {
            const s = lineState[l.id];
            return (
              <div key={l.id} className="border border-line p-3">
                <div className="flex items-start gap-2 mb-2">
                  <span className="font-mono text-[10px] text-ink-50 mt-1">{l.position}</span>
                  <div className="flex-1">
                    <div className="text-[12px] font-extrabold">{l.description}</div>
                    <div className="text-[10px] text-ink-50 font-mono mt-0.5">
                      {l.quantity.toLocaleString()} {l.uom}
                      {l.manufacturer ? ` · ${l.manufacturer}` : ''}
                      {l.mfrPartNumber ? ` · ${l.mfrPartNumber}` : ''}
                    </div>
                  </div>
                  <label className="flex items-center gap-1 text-[11px] text-ink-70">
                    <input
                      type="checkbox"
                      checked={s.available}
                      onChange={(e) => setLine(l.id, { available: e.target.checked })}
                      className="w-3.5 h-3.5 accent-orange"
                    />
                    Available
                  </label>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 md:col-span-3">
                    <LabelSm>Unit price ($/UoM)</LabelSm>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      disabled={!s.available}
                      value={s.unitPrice}
                      onChange={(e) => setLine(l.id, { unitPrice: e.target.value })}
                      className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px] font-mono text-right disabled:opacity-50"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <LabelSm>Lead (days)</LabelSm>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      disabled={!s.available}
                      value={s.leadTimeDays}
                      onChange={(e) => setLine(l.id, { leadTimeDays: e.target.value })}
                      className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px] font-mono text-right disabled:opacity-50"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <LabelSm>Vendor SKU</LabelSm>
                    <input
                      type="text"
                      maxLength={100}
                      disabled={!s.available}
                      value={s.vendorSku}
                      onChange={(e) => setLine(l.id, { vendorSku: e.target.value })}
                      className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px] font-mono disabled:opacity-50"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <LabelSm>Notes (optional)</LabelSm>
                    <input
                      type="text"
                      maxLength={200}
                      value={s.notes}
                      onChange={(e) => setLine(l.id, { notes: e.target.value })}
                      className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-1 text-[10px] text-ink-50 mt-2">
                  <input
                    type="checkbox"
                    checked={s.isSubstitute}
                    onChange={(e) => setLine(l.id, { isSubstitute: e.target.checked })}
                    className="w-3.5 h-3.5 accent-orange"
                  />
                  Substitute
                </label>
                {s.isSubstitute ? (
                  <input
                    type="text"
                    placeholder="What you're offering instead"
                    maxLength={500}
                    value={s.substituteNote}
                    onChange={(e) => setLine(l.id, { substituteNote: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-cream-2 border border-line p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Subtotal</div>
          <div className="font-mono text-right">${computed.subtotal.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Freight</div>
          <div className="font-mono text-right">${computed.freight.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Tax</div>
          <div className="font-mono text-right">${computed.tax.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Total</div>
          <div className="font-mono text-right font-extrabold">${computed.total.toFixed(2)}</div>
        </div>
      </div>

      {error ? (
        <div className="bg-error/10 border border-error p-2 text-[12px] text-error font-semibold">
          ⚠ {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-line">
        <button
          type="button"
          onClick={() => setDeclineOpen((v) => !v)}
          className="px-3 py-2 border border-line text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-70 hover:border-ink"
        >
          {declineOpen ? 'Cancel decline' : 'Decline to quote'}
        </button>
        <button
          type="submit"
          disabled={
            pending ||
            !meta.respondentName ||
            !meta.respondentEmail ||
            // Require ≥1 priced or marked-unavailable line. Spec
            // §5 transition: "SENT/VIEWED → RESPONDED requires
            // ≥1 line priced or declined".
            !lines.some((l) => lineState[l.id].unitPrice || !lineState[l.id].available)
          }
          className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Submitting…' : existing ? `Submit revision ${existing.revision + 1}` : 'Submit quote'}
        </button>
      </div>

      {declineOpen ? (
        <div className="bg-cream-2 border border-line p-3 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            Decline to quote {vendorName}
          </div>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Why? (e.g. out of stock, lead time too long, can't meet terms)"
            maxLength={500}
            rows={2}
            className="w-full px-2 py-1.5 bg-paper border border-line text-ink text-[12px] resize-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={decline}
              disabled={pending || !meta.respondentName || !meta.respondentEmail}
              className="px-3 py-1.5 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              Confirm decline
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

interface LineState {
  unitPrice: string;
  available: boolean;
  leadTimeDays: string;
  vendorSku: string;
  isSubstitute: boolean;
  substituteNote: string;
  notes: string;
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
  lines: PortalLine[],
  state: Record<string, LineState>,
  meta: { freightAmount: string; taxAmount: string },
) {
  let subtotal = 0;
  for (const l of lines) {
    const s = state[l.id];
    if (!s?.available) continue;
    const price = s.unitPrice ? Number(s.unitPrice) : 0;
    if (Number.isFinite(price)) subtotal += price * l.quantity;
  }
  const freight = Number(meta.freightAmount) || 0;
  const tax = Number(meta.taxAmount) || 0;
  return { subtotal, freight, tax, total: subtotal + freight + tax };
}
