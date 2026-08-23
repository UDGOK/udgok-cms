'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendRfiAction } from '@/lib/submittals/actions';

interface RfiRow {
  id: string;
  number: string;
  revision: number;
  subject: string;
  status: string;
  costImpact: boolean;
  scheduleImpact: boolean;
  submittedAt: Date | null;
  answeredAt: Date | null;
  dueDate: Date | null;
  createdByName: string | null;
  createdAt: Date;
}

export function RfisTable({
  rfis,
  workspaceSlug,
  projectId,
  statusColor,
}: {
  rfis: RfiRow[];
  workspaceSlug: string;
  projectId: string;
  statusColor: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSend(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await sendRfiAction({ workspaceSlug, projectId, rfiId: id });
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
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Subject</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Impact</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Status</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rfis.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-3 font-mono whitespace-nowrap">
                  {r.number}
                  {r.revision > 1 ? <span className="text-ink-60"> R{r.revision}</span> : null}
                </td>
                <td className="px-3 py-3 max-w-md">
                  <div className="font-semibold">{r.subject}</div>
                  <div className="text-[11px] text-ink-60 mt-0.5">
                    {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                    {r.createdByName ? ` · ${r.createdByName}` : ''}
                    {r.dueDate ? ` · Due ${new Date(r.dueDate).toLocaleDateString()}` : ''}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs space-x-1">
                  {r.costImpact ? <span className="px-1.5 py-0.5 bg-orange/20 text-orange">$</span> : null}
                  {r.scheduleImpact ? <span className="px-1.5 py-0.5 bg-warning/20 text-warning">T</span> : null}
                  {!r.costImpact && !r.scheduleImpact ? <span className="text-ink-50">—</span> : null}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`text-[10px] uppercase font-mono px-2 py-1 ${statusColor[r.status] ?? 'bg-ink-30 text-ink'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {r.status === 'DRAFT' ? (
                    <button
                      type="button"
                      onClick={() => onSend(r.id)}
                      disabled={isPending}
                      className="text-ink underline text-xs disabled:opacity-50"
                    >
                      Send
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
