'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { generatePayAppAction } from '@/lib/pay-apps/actions';
import { Button, Input, Field } from '@/components/ui';

interface Division {
  id: string;
  code: string;
  trade: string;
  subcontractorName: string | null;
  budget: number;
  previous: number;
  lastBilledDraw: number | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? 'Generating…' : 'Generate draft pay app'}
    </Button>
  );
}

export function NewPayAppForm({
  workspaceSlug,
  projectId,
  divisions,
}: {
  workspaceSlug: string;
  projectId: string;
  divisions: Division[];
}) {
  const router = useRouter();
  const [draws, setDraws] = useState<Record<string, number>>(
    Object.fromEntries(divisions.map((d) => [d.id, 0])),
  );
  const [state, formAction] = useFormState(
    generatePayAppAction.bind(null, workspaceSlug, projectId),
    undefined as { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined,
  );

  // When the action returns a new pay app id, navigate to it.
  useEffect(() => {
    if (state?.id) {
      router.push(`/w/${workspaceSlug}/projects/${projectId}/pay-apps/${state.id}`);
    }
  }, [state, router, workspaceSlug, projectId]);

  const totalThisDraw = Object.values(draws).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const totalBudget = divisions.reduce((acc, d) => acc + d.budget, 0);
  const totalPrevious = divisions.reduce((acc, d) => acc + d.previous, 0);
  const totalRemaining = totalBudget - totalPrevious - totalThisDraw;

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      {/* Period */}
      <div className="bg-paper border-2 border-line p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="label-eyebrow">{'// Period'}</div>
          {divisions.some((d) => d.lastBilledDraw !== null) ? (
            <div className="text-[11px] font-mono text-ink-50">
              Previous draw billed:{' '}
              {divisions
                .filter((d) => d.lastBilledDraw !== null)
                .map((d) => `#${d.lastBilledDraw}`)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(', ')}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Period start" htmlFor="periodStart">
            <Input id="periodStart" name="periodStart" type="date" required />
          </Field>
          <Field label="Period end" htmlFor="periodEnd">
            <Input id="periodEnd" name="periodEnd" type="date" required />
          </Field>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-paper border-2 border-line">
        <div className="px-6 py-4 border-b border-line">
          <div className="label-eyebrow">{'// Lines'}</div>
          <div className="text-[11px] text-ink-50 mt-0.5">
            Budget ${totalBudget.toLocaleString()} · Previously billed ${totalPrevious.toLocaleString()}
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Code', 'Trade', 'Budget', 'Prev Billed', 'This Draw', 'Remaining'].map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {divisions.map((d) => {
              const remaining = d.budget - d.previous - (draws[d.id] || 0);
              return (
                <tr key={d.id}>
                  <td className="px-5 py-3 border-b border-line-soft font-mono text-[12px]">{d.code}</td>
                  <td className="px-5 py-3 border-b border-line-soft font-extrabold text-[13px]">
                    {d.trade}
                    {d.subcontractorName ? (
                      <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-0.5">
                        {d.subcontractorName}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 border-b border-line-soft font-black">${d.budget.toLocaleString()}</td>
                  <td className="px-5 py-3 border-b border-line-soft font-extrabold text-ink-50">${d.previous.toLocaleString()}</td>
                  <td className="px-5 py-3 border-b border-line-soft">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={`thisDraw_${d.id}`}
                      value={draws[d.id] ?? 0}
                      onChange={(e) => setDraws({ ...draws, [d.id]: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
                    />
                  </td>
                  <td className={`px-5 py-3 border-b border-line-soft font-black ${remaining < 0 ? 'text-error' : 'text-orange-d'}`}>
                    ${remaining.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-ink text-cream">
              <td colSpan={4} className="px-5 py-3 font-extrabold uppercase text-[11px] tracking-[0.12em]">Totals</td>
              <td className="px-5 py-3 font-black text-lg text-orange-l">${totalThisDraw.toLocaleString()}</td>
              <td className="px-5 py-3 font-black text-lg">${totalRemaining.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="bg-paper border-2 border-line p-6">
        <Field label="Notes (optional)" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
            placeholder="Materials delivered 3/15, framing complete 3/20, etc."
          />
        </Field>
      </div>

      {state?.error ? (
        <p className="text-sm text-error font-semibold">{state.error}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
