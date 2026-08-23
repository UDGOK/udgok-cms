'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitSubmittalAction } from '@/lib/submittals/actions';

interface SubmittalRow {
  id: string;
  number: string;
  specSection: string;
  specSequence: number;
  revision: number;
  title: string;
  status: string;
  disposition: string | null;
  submittedAt: Date | null;
  requiredByDate: Date | null;
  subcontractorName: string | null;
  createdAt: Date;
}

export function SubmittalsTable({
  submittals,
  workspaceSlug,
  projectId,
  statusColor,
}: {
  submittals: SubmittalRow[];
  workspaceSlug: string;
  projectId: string;
  statusColor: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await submitSubmittalAction({ workspaceSlug, projectId, submittalId: id });
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
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">CSI Section</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Title</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Sub</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider">Status</th>
              <th className="px-3 py-2 font-mono uppercase text-[10px] tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submittals.map((s) => (
              <tr key={s.id} className="border-t border-line align-top">
                <td className="px-3 py-3 font-mono whitespace-nowrap">
                  {s.number}
                  {s.revision > 1 ? <span className="text-ink-60"> R{s.revision}</span> : null}
                </td>
                <td className="px-3 py-3 font-mono text-xs">
                  {s.specSection}-{String(s.specSequence).padStart(3, '0')}
                </td>
                <td className="px-3 py-3 max-w-md">
                  <div className="font-semibold">{s.title}</div>
                  {s.requiredByDate ? (
                    <div className="text-[11px] text-warning mt-0.5">
                      Needed by {new Date(s.requiredByDate).toLocaleDateString()}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-xs">{s.subcontractorName ?? <span className="text-ink-50">—</span>}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`text-[10px] uppercase font-mono px-2 py-1 ${statusColor[s.status] ?? 'bg-ink-30 text-ink'}`}>
                    {s.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {s.status === 'DRAFT' ? (
                    <button
                      type="button"
                      onClick={() => onSubmit(s.id)}
                      disabled={isPending}
                      className="text-ink underline text-xs disabled:opacity-50"
                    >
                      Send for review
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
