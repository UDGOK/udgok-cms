'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Input, Field } from '@/components/ui';
import { assignSubcontractorAction } from '@/lib/subs/actions';

interface SubOption {
  id: string;
  name: string;
  primaryTrade: string | null;
}

interface DivisionOption {
  id: string;
  code: string;
  trade: string;
  budget: number;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" size="sm" disabled={pending}>
      {pending ? 'Assigning…' : '+ Assign'}
    </Button>
  );
}

export function AssignSubForm({
  workspaceSlug,
  projectId,
  subs,
  divisions,
}: {
  workspaceSlug: string;
  projectId: string;
  subs: SubOption[];
  divisions: DivisionOption[];
}) {
  const [open, setOpen] = useState(false);
  const [subId, setSubId] = useState('');
  const [pickedDivs, setPickedDivs] = useState<Set<string>>(new Set());
  const [state, formAction] = useFormState(
    assignSubcontractorAction.bind(null, workspaceSlug, projectId),
    undefined as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  );

  if (!open) {
    return (
      <Button variant="copper" size="sm" onClick={() => setOpen(true)}>
        + Assign subcontractor
      </Button>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="bg-cream-2 border-2 border-dashed border-line p-5 text-center text-[12px] text-ink-50">
        Add a subcontractor to your library first, then come back to assign them.
        <div className="mt-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  function toggleDiv(id: string) {
    setPickedDivs((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <form
      action={async (fd) => {
        fd.set('subcontractorId', subId);
        fd.set('divisionIds', JSON.stringify(Array.from(pickedDivs)));
        const result = (await formAction(fd)) as { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;
        if (result?.ok) {
          setOpen(false);
          setSubId('');
          setPickedDivs(new Set());
        }
      }}
      className="space-y-3"
    >
      <Field label="Subcontractor" htmlFor="assign-sub">
        <select
          id="assign-sub"
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          required
          className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
        >
          <option value="">Pick from your library…</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.primaryTrade ? ` · ${s.primaryTrade}` : ''}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
          What will they do? (pick divisions)
        </label>
        {divisions.length === 0 ? (
          <p className="text-[11px] text-ink-50">No divisions yet. Add the schedule of values first.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto border border-line p-2 bg-paper">
            {divisions.map((d) => {
              const isOn = pickedDivs.has(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-2 px-2 py-1.5 border cursor-pointer transition-colors ${
                    isOn ? 'border-ink bg-cream' : 'border-line-soft hover:border-ink'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggleDiv(d.id)}
                    className="w-3.5 h-3.5 accent-orange"
                  />
                  <span className="font-mono text-[11px] font-extrabold text-orange-d w-[34px]">{d.code}</span>
                  <span className="font-extrabold text-[12px] truncate flex-1">{d.trade}</span>
                  <span className="font-mono text-[10px] text-ink-50">${d.budget.toLocaleString()}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Contract amount" htmlFor="assign-amt" error={state?.fieldErrors?.contractAmount}>
          <Input id="assign-amt" name="contractAmount" type="number" step="0.01" min="0" placeholder="0.00" />
        </Field>
        <Field label="Status" htmlFor="assign-status">
          <select
            id="assign-status"
            name="status"
            defaultValue="PROPOSED"
            className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
          >
            <option value="PROPOSED">Proposed</option>
            <option value="CONTRACTED">Contracted</option>
            <option value="ACTIVE">Active</option>
          </select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="assign-notes">
        <textarea id="assign-notes" name="notes" rows={2} className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink" />
      </Field>

      {state?.error && !state.fieldErrors ? <p className="text-sm text-error font-semibold">{state.error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <SubmitButton />
      </div>
    </form>
  );
}
