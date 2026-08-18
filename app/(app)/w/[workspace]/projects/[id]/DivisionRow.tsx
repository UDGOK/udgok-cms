'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useFormState } from 'react-dom';
import { updateDivisionAction, deleteDivisionAction } from '@/lib/projects/actions';
import { CodePicker } from '@/components/construction/CodePicker';

type UpdateDivisionState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

export function DivisionRow({
  workspaceSlug,
  projectId,
  division,
  billed,
}: {
  workspaceSlug: string;
  projectId: string;
  division: {
    id: string;
    code: string;
    trade: string;
    budget: number;
    subcontractorName: string | null;
    linkedSub: { id: string; name: string } | null;
  };
  billed: number;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(division.code);
  const [trade, setTrade] = useState(division.trade);
  const [subcontractorName, setSubcontractorName] = useState(division.subcontractorName ?? '');
  const [budget, setBudget] = useState(String(division.budget));
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [state, formAction] = useFormState(
    updateDivisionAction.bind(null, workspaceSlug, projectId, division.id),
    undefined as UpdateDivisionState,
  );

  const rem = division.budget - billed;

  function resetFields() {
    setCode(division.code);
    setTrade(division.trade);
    setSubcontractorName(division.subcontractorName ?? '');
    setBudget(String(division.budget));
  }

  function onDelete() {
    if (!confirm(`Delete "${division.trade}" (${division.code}) from the schedule of values?`)) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteDivisionAction(workspaceSlug, projectId, division.id);
      if (!result.ok) setDeleteError(result.error ?? 'Delete failed');
    });
  }

  if (editing) {
    return (
      <tr className="bg-cream-2">
        <td colSpan={7} className="px-3 md:px-5 py-4 border-b border-line-soft">
          <form
            action={async (fd) => {
              fd.set('code', code);
              fd.set('trade', trade);
              fd.set('subcontractorName', subcontractorName);
              fd.set('budget', budget);
              const result = (await formAction(fd)) as UpdateDivisionState;
              if (result?.ok) setEditing(false);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-12 gap-3">
              <CodePicker
                code={code}
                trade={trade}
                onChange={(next) => {
                  setCode(next.code);
                  setTrade(next.trade);
                }}
                codeError={state?.fieldErrors?.code}
                tradeError={state?.fieldErrors?.trade}
              />
              <div className="col-span-4">
                <label className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Trade / description
                </label>
                <input
                  type="text"
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className={`block w-full px-3.5 py-3 bg-paper border text-ink text-sm outline-none focus:border-ink ${
                    state?.fieldErrors?.trade ? 'border-error' : 'border-line'
                  }`}
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Subcontractor
                </label>
                <input
                  type="text"
                  value={subcontractorName}
                  onChange={(e) => setSubcontractorName(e.target.value)}
                  placeholder="Acme Concrete"
                  className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Budget
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={`block w-full px-3.5 py-3 bg-paper border text-ink text-sm outline-none focus:border-ink ${
                    state?.fieldErrors?.budget ? 'border-error' : 'border-line'
                  }`}
                  required
                />
              </div>
            </div>

            {state?.error && !state.fieldErrors ? (
              <p className="text-sm text-error font-semibold">{state.error}</p>
            ) : null}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  resetFields();
                }}
                className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-50 hover:text-ink px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-[11px] font-extrabold uppercase tracking-[0.1em] bg-orange text-ink px-4 py-2 hover:bg-orange-d"
              >
                Save
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-cream-2">
      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-mono text-[12px]">{division.code}</td>
      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-extrabold text-[13px]">{division.trade}</td>
      <td className="px-3 md:px-5 py-3 border-b border-line-soft text-[12px]">
        {division.linkedSub ? (
          <Link
            href={`/w/${workspaceSlug}/subcontractors/${division.linkedSub.id}`}
            className="text-orange-d font-extrabold hover:underline"
          >
            {division.linkedSub.name}
          </Link>
        ) : division.subcontractorName ? (
          <span className="text-ink-70">{division.subcontractorName}</span>
        ) : (
          <span className="text-ink-30">—</span>
        )}
      </td>
      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-black">${division.budget.toLocaleString()}</td>
      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-black text-success">${billed.toLocaleString()}</td>
      <td className="px-3 md:px-5 py-3 border-b border-line-soft font-black text-orange-d">${rem.toLocaleString()}</td>
      <td className="px-3 md:px-5 py-3 border-b border-line-soft text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-50 hover:text-ink mr-3"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-50 hover:text-error disabled:opacity-50"
        >
          {deletePending ? '…' : 'Delete'}
        </button>
        {deleteError ? (
          <div className="text-[10px] text-error mt-1 max-w-[220px] whitespace-normal text-right">{deleteError}</div>
        ) : null}
      </td>
    </tr>
  );
}
