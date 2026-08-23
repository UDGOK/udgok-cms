'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createLienWaiverAction } from '@/lib/lien-waivers/actions';

interface SubLite { id: string; name: string }
interface PayAppLite { id: string; drawNumber: number; periodEnd: string; totalCents: number }

export function NewLienWaiverButton({
  projectId,
  workspaceSlug,
  subcontractorOptions,
  payAppOptions,
  primary = false,
}: {
  projectId: string;
  workspaceSlug: string;
  subcontractorOptions: SubLite[];
  payAppOptions: PayAppLite[];
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [type, setType] = useState<'CONDITIONAL_PROGRESS' | 'UNCONDITIONAL_PROGRESS' | 'CONDITIONAL_FINAL' | 'UNCONDITIONAL_FINAL'>('CONDITIONAL_PROGRESS');
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [payAppId, setPayAppId] = useState<string>('');
  const [amountUsd, setAmountUsd] = useState<string>('0');
  const [throughDate, setThroughDate] = useState<string>('');
  const [exceptionText, setExceptionText] = useState<string>('');

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setType('CONDITIONAL_PROGRESS');
    setSubcontractorId('');
    setPayAppId('');
    setAmountUsd('0');
    setThroughDate('');
    setExceptionText('');
  }

  function onPickPayApp(paId: string) {
    setPayAppId(paId);
    const pa = payAppOptions.find((p) => p.id === paId);
    if (pa) {
      setAmountUsd((pa.totalCents / 100).toString());
      // Default through-date = pay app period end
      setThroughDate(new Date(pa.periodEnd).toISOString().slice(0, 10));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number(amountUsd) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setError('Amount must be a non-negative number');
      return;
    }
    if (!throughDate) {
      setError('Through date is required');
      return;
    }
    startTransition(async () => {
      const res = await createLienWaiverAction({
        workspaceSlug,
        projectId,
        type,
        subcontractorId: subcontractorId || null,
        payAppId: payAppId || null,
        amountCents: cents,
        throughDate,
        exceptionText: exceptionText.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          primary
            ? 'px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm'
            : 'px-4 py-2 bg-ink text-paper font-bold uppercase tracking-wider text-sm whitespace-nowrap'
        }
      >
        + New lien waiver
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={submit} className="bg-paper border-2 border-ink w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between sticky top-0 bg-paper z-10">
              <h2 className="text-lg font-extrabold">New lien waiver</h2>
              <button type="button" onClick={close} disabled={isPending} className="text-ink-70 text-2xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                >
                  <option value="CONDITIONAL_PROGRESS">Conditional progress (waives on receipt of payment)</option>
                  <option value="UNCONDITIONAL_PROGRESS">Unconditional progress (waives now)</option>
                  <option value="CONDITIONAL_FINAL">Conditional final (waives on final payment)</option>
                  <option value="UNCONDITIONAL_FINAL">Unconditional final (waives all rights)</option>
                </select>
                <p className="text-[11px] text-ink-60 mt-1">
                  Oklahoma is a non-statutory waiver state — the four flavors above
                  (mirroring AIA G901-G904) are the industry-standard.
                </p>
              </label>

              {subcontractorOptions.length > 0 ? (
                <label className="block text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Subcontractor</span>
                  <select
                    value={subcontractorId}
                    onChange={(e) => setSubcontractorId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-line bg-paper"
                  >
                    <option value="">(no sub — project-level)</option>
                    {subcontractorOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {payAppOptions.length > 0 ? (
                <label className="block text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Pay application (optional)</span>
                  <select
                    value={payAppId}
                    onChange={(e) => onPickPayApp(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-line bg-paper"
                  >
                    <option value="">(no pay app — final waiver)</option>
                    {payAppOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.drawNumber} — {new Date(p.periodEnd).toLocaleDateString()} (${(p.totalCents / 100).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Amount (USD)</span>
                  <input
                    type="number"
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border-2 border-line bg-paper tabular-nums font-mono"
                  />
                </label>
                <label className="text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Through date <span className="text-error">*</span></span>
                  <input
                    type="date"
                    value={throughDate}
                    onChange={(e) => setThroughDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-line bg-paper"
                    required
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Exceptions or carve-outs (optional)</span>
                <textarea
                  value={exceptionText}
                  onChange={(e) => setExceptionText(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                  placeholder="e.g. Retainage not yet released by the owner; punch list items."
                />
              </label>

              {error ? <p className="text-error text-sm">{error}</p> : null}
            </div>
            <div className="px-6 py-4 border-t-2 border-ink flex justify-end gap-2 sticky bottom-0 bg-paper">
              <button type="button" onClick={close} disabled={isPending} className="px-4 py-2 text-ink-70 text-sm">Cancel</button>
              <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50">
                {isPending ? 'Creating…' : 'Create waiver (DRAFT)'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
