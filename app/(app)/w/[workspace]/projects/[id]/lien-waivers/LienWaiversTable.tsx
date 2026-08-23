'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendLienWaiverAction, voidLienWaiverAction } from '@/lib/lien-waivers/actions';
import { fmtUsdFromCents as fmtUsd } from '@/lib/format/currency';

interface WaiverRow {
  id: string;
  number: string;
  type: string;
  status: string;
  amountCents: number;
  throughDate: Date;
  signedAt: Date | null;
  signerName: string | null;
  subcontractorName: string | null;
  payAppNumber: number | null;
  createdAt: Date;
}

export function LienWaiversTable({
  waivers,
  workspaceSlug,
  projectId,
  statusColor,
  typeLabel,
}: {
  waivers: WaiverRow[];
  workspaceSlug: string;
  projectId: string;
  statusColor: Record<string, string>;
  typeLabel: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSend(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await sendLienWaiverAction({ workspaceSlug, projectId, waiverId: id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }
  function onVoid(id: string) {
    setError(null);
    const reason = prompt('Why are you voiding this waiver?');
    if (!reason) return;
    startTransition(async () => {
      const res = await voidLienWaiverAction({ workspaceSlug, projectId, waiverId: id, reason });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      {error ? <div className="mb-3 p-3 border-2 border-error text-error text-sm">{error}</div> : null}
      <div className="bg-paper border-2 border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink text-paper text-left">
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Number</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Type</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Sub</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Pay app</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider text-right">Amount</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Through</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Status</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {waivers.map((w) => (
              <tr key={w.id} className="border-t border-line align-top">
                <td className="px-3 py-3 font-mono">{w.number}</td>
                <td className="px-3 py-3">{typeLabel[w.type] ?? w.type}</td>
                <td className="px-3 py-3">{w.subcontractorName ?? <span className="text-ink-50">—</span>}</td>
                <td className="px-3 py-3 font-mono">{w.payAppNumber ? `#${w.payAppNumber}` : <span className="text-ink-50">—</span>}</td>
                <td className="px-3 py-3 text-right tabular-nums font-mono">{fmtUsd(w.amountCents)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-xs">
                  {new Date(w.throughDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`text-[10px] uppercase font-mono px-2 py-1 ${statusColor[w.status] ?? 'bg-ink-30 text-ink'}`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="flex flex-col gap-1 items-end">
                    {w.status === 'DRAFT' ? (
                      <button
                        type="button"
                        onClick={() => onSend(w.id)}
                        disabled={isPending}
                        className="text-ink underline text-xs disabled:opacity-50"
                      >
                        Send for signature
                      </button>
                    ) : null}
                    {w.status === 'SENT' || w.status === 'VIEWED' ? (
                      <button
                        type="button"
                        onClick={() => onVoid(w.id)}
                        disabled={isPending}
                        className="text-error underline text-xs disabled:opacity-50"
                      >
                        Void
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
