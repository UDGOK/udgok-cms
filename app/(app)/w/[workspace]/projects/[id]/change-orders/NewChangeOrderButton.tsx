'use client';

/**
 * "+ New change order" button + modal. The modal collects
 *   - type (ADDITIVE / DEDUCTIVE / NEUTRAL / TIME_ONLY)
 *   - pricing method
 *   - reason code (8 options)
 *   - title + description
 *   - this CO amount (signed — negative for deductive)
 *   - time impact days
 *   - per-division allocation (optional — defaults to nothing)
 *
 * The form posts to createChangeOrderAction, which allocates
 * the CO number from DocCounter inside a transaction.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createChangeOrderAction } from '@/lib/change-orders/actions';

interface DivisionLite {
  id: string;
  code: string;
  trade: string;
  budget: number;
}

export function NewChangeOrderButton({
  projectId,
  workspaceSlug,
  contractValue,
  divisions,
  primary = false,
}: {
  projectId: string;
  workspaceSlug: string;
  contractValue: number;
  divisions: DivisionLite[];
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Form state
  const [type, setType] = useState<'ADDITIVE' | 'DEDUCTIVE' | 'NEUTRAL' | 'TIME_ONLY'>('ADDITIVE');
  const [pricingMethod, setPricingMethod] = useState<'LUMP_SUM' | 'UNIT_PRICE' | 'TIME_AND_MATERIALS' | 'COST_PLUS'>('LUMP_SUM');
  const [reasonCode, setReasonCode] = useState<string>('OWNER_REQUEST');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thisCOAmount, setThisCOAmount] = useState<string>('0');
  const [timeImpactDays, setTimeImpactDays] = useState<string>('0');
  const [allocations, setAllocations] = useState<Record<string, { thisCOAmount: number; newBudgetDelta: number }>>({});

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setTitle('');
    setDescription('');
    setThisCOAmount('0');
    setTimeImpactDays('0');
    setType('ADDITIVE');
    setReasonCode('OWNER_REQUEST');
    setAllocations({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const amt = Number(thisCOAmount);
    if (!Number.isFinite(amt)) {
      setError('Amount must be a number');
      return;
    }
    // Normalize: if DEDUCTIVE, the user may have entered a positive
    // number. We honor whatever they typed (it gets stored as-is
    // and the newContractSum math subtracts) but warn at $0.
    startTransition(async () => {
      const res = await createChangeOrderAction({
        workspaceSlug,
        projectId,
        type,
        pricingMethod,
        reasonCode: reasonCode as never,
        title: title.trim(),
        description: description.trim() || null,
        thisCOAmount: amt,
        timeImpactDays: Number(timeImpactDays) || 0,
        divisionAllocations: allocations,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.push(`/w/${workspaceSlug}/projects/${projectId}/change-orders/${res.changeOrderId}`);
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
        + New change order
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={submit}
            className="bg-paper border-2 border-ink w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between sticky top-0 bg-paper z-10">
              <h2 className="text-lg font-extrabold">New change order</h2>
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="text-ink-70 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Type</span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                    className="w-full px-3 py-2 border-2 border-line bg-paper"
                  >
                    <option value="ADDITIVE">Additive (+$)</option>
                    <option value="DEDUCTIVE">Deductive (-$)</option>
                    <option value="NEUTRAL">Neutral (no $)</option>
                    <option value="TIME_ONLY">Time only</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Pricing</span>
                  <select
                    value={pricingMethod}
                    onChange={(e) => setPricingMethod(e.target.value as typeof pricingMethod)}
                    className="w-full px-3 py-2 border-2 border-line bg-paper"
                  >
                    <option value="LUMP_SUM">Lump sum</option>
                    <option value="UNIT_PRICE">Unit price</option>
                    <option value="TIME_AND_MATERIALS">T&M (not to exceed)</option>
                    <option value="COST_PLUS">Cost plus</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Reason</span>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                >
                  <option value="OWNER_REQUEST">Owner request</option>
                  <option value="RFI">RFI</option>
                  <option value="ASI">Architect supplemental instruction</option>
                  <option value="DIFFERING_SITE_CONDITION">Differing site condition</option>
                  <option value="CODE_REQUIREMENT">Code requirement</option>
                  <option value="DESIGN_OMISSION">Design omission</option>
                  <option value="FIELD_CONDITION">Field condition</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                  required
                  maxLength={200}
                  placeholder="e.g. Add 3rd floor sprinkler heads"
                />
              </label>

              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                  placeholder="What changed, and why? Be specific so the owner/architect can sign without a phone call."
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">
                    This CO amount (USD, can be negative)
                  </span>
                  <input
                    type="number"
                    value={thisCOAmount}
                    onChange={(e) => setThisCOAmount(e.target.value)}
                    step="0.01"
                    className="w-full px-3 py-2 border-2 border-line bg-paper tabular-nums font-mono"
                  />
                </label>
                <label className="text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">
                    Time impact (calendar days)
                  </span>
                  <input
                    type="number"
                    value={timeImpactDays}
                    onChange={(e) => setTimeImpactDays(e.target.value)}
                    step="1"
                    min="0"
                    className="w-full px-3 py-2 border-2 border-line bg-paper tabular-nums font-mono"
                  />
                </label>
              </div>

              {divisions.length > 0 ? (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-2">
                    Division allocation (optional)
                  </div>
                  <div className="border-2 border-line max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-ink-10 text-[10px] uppercase font-mono">
                          <th className="px-2 py-1 text-left">Division</th>
                          <th className="px-2 py-1 text-right">This CO $</th>
                          <th className="px-2 py-1 text-right">Budget Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divisions.map((d) => (
                          <tr key={d.id} className="border-t border-line">
                            <td className="px-2 py-1.5">
                              <div className="font-mono text-xs">{d.code}</div>
                              <div className="text-ink-70 text-xs">{d.trade}</div>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={allocations[d.id]?.thisCOAmount ?? ''}
                                onChange={(e) =>
                                  setAllocations((a) => ({
                                    ...a,
                                    [d.id]: {
                                      thisCOAmount: Number(e.target.value) || 0,
                                      newBudgetDelta: a[d.id]?.newBudgetDelta ?? 0,
                                    },
                                  }))
                                }
                                className="w-24 px-2 py-1 border border-line bg-paper text-right tabular-nums"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={allocations[d.id]?.newBudgetDelta ?? ''}
                                onChange={(e) =>
                                  setAllocations((a) => ({
                                    ...a,
                                    [d.id]: {
                                      thisCOAmount: a[d.id]?.thisCOAmount ?? 0,
                                      newBudgetDelta: Number(e.target.value) || 0,
                                    },
                                  }))
                                }
                                className="w-24 px-2 py-1 border border-line bg-paper text-right tabular-nums"
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-ink-60 mt-1">
                    If you leave these blank, the CO captures the total only — apply
                    it on the next pay app manually.
                  </p>
                </div>
              ) : null}

              {error ? <p className="text-error text-sm">{error}</p> : null}

              <div className="pt-2 text-xs text-ink-60 font-mono">
                Original contract: ${contractValue.toLocaleString()} · This CO will set
                the new contract to ${(contractValue + Number(thisCOAmount || 0)).toLocaleString()}
              </div>
            </div>
            <div className="px-6 py-4 border-t-2 border-ink flex justify-end gap-2 sticky bottom-0 bg-paper">
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="px-4 py-2 text-ink-70 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50"
              >
                {isPending ? 'Creating…' : 'Create change order'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
