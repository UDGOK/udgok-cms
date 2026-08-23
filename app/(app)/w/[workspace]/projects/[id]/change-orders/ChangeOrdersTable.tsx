'use client';

/**
 * The change-order table + per-row action menu. Server actions
 * for submit/withdraw are imported from @/lib/change-orders/actions.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitChangeOrderAction, withdrawChangeOrderAction } from '@/lib/change-orders/actions';

interface CoRow {
  id: string;
  number: string;
  revision: number;
  status: string;
  type: string;
  title: string;
  thisCOAmount: number;
  newContractSum: number;
  createdAt: Date;
  createdByName: string | null;
}

export function ChangeOrdersTable({
  cos,
  workspaceSlug,
  projectId,
  statusColor,
}: {
  cos: CoRow[];
  workspaceSlug: string;
  projectId: string;
  statusColor: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(coId: string) {
    setError(null);
    startTransition(async () => {
      const res = await submitChangeOrderAction({ workspaceSlug, projectId, coId });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }
  function onWithdraw(coId: string) {
    setError(null);
    if (!confirm('Withdraw this change order? The owner/architect will no longer be able to sign it.')) return;
    startTransition(async () => {
      const res = await withdrawChangeOrderAction({ workspaceSlug, projectId, coId });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const fmtUsd = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      {error ? (
        <div className="mb-3 p-3 border-2 border-error text-error text-sm">{error}</div>
      ) : null}
      <div className="bg-paper border-2 border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink text-paper text-left">
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Number</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Title</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Type</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider text-right">Amount</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider text-right">New contract</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Status</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cos.map((co) => (
              <tr key={co.id} className="border-t border-line align-top">
                <td className="px-3 py-3 font-mono whitespace-nowrap">
                  {co.number}
                  {co.revision > 1 ? <span className="text-ink-60"> R{co.revision}</span> : null}
                </td>
                <td className="px-3 py-3 max-w-md">
                  <div className="font-semibold">{co.title}</div>
                  <div className="text-[11px] text-ink-60 mt-0.5">
                    {new Date(co.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                    {co.createdByName ? ` · ${co.createdByName}` : ''}
                  </div>
                </td>
                <td className="px-3 py-3 text-[10px] uppercase font-mono">
                  {co.type.replace('_', ' ')}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-mono">
                  {co.thisCOAmount >= 0 ? '+' : ''}{fmtUsd(co.thisCOAmount)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-mono">
                  {fmtUsd(co.newContractSum)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`text-[10px] uppercase font-mono px-2 py-1 ${statusColor[co.status] ?? 'bg-ink-30 text-ink'}`}>
                    {co.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="flex flex-col gap-1 items-end">
                    <Link
                      href={`/w/${workspaceSlug}/projects/${projectId}/change-orders/${co.id}`}
                      className="text-ink underline text-xs"
                    >
                      Open
                    </Link>
                    {(co.status === 'DRAFT' || co.status === 'REVISED') ? (
                      <button
                        type="button"
                        onClick={() => onSubmit(co.id)}
                        disabled={isPending}
                        className="text-ink underline text-xs disabled:opacity-50"
                      >
                        Send for signature
                      </button>
                    ) : null}
                    {co.status === 'SUBMITTED' || co.status === 'UNDER_REVIEW' || co.status === 'PARTIALLY_APPROVED' ? (
                      <button
                        type="button"
                        onClick={() => onWithdraw(co.id)}
                        disabled={isPending}
                        className="text-error underline text-xs disabled:opacity-50"
                      >
                        Withdraw
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
