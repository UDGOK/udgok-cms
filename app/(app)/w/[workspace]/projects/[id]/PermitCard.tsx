'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';
import {
  createInspectionAction,
  updateInspectionResultAction,
  deleteInspectionAction,
} from '@/lib/permits/actions';
import { INSPECTION_TYPE_LABELS, INSPECTION_RESULT_LABELS } from '@/lib/permits/queries';

const RESULT_STYLES: Record<string, string> = {
  PENDING: 'bg-warning text-ink',
  PASSED: 'bg-success text-paper',
  FAILED: 'bg-error text-paper',
  PARTIAL: 'bg-orange text-paper',
  CANCELLED: 'bg-ink-30 text-ink',
};

interface Inspection {
  id: string;
  type: string;
  result: string;
  scheduledDate: Date | null;
  completedDate: Date | null;
  inspectorName: string | null;
  scheduledBy: string | null;
  notes: string | null;
}

interface PermitCardProps {
  workspaceSlug: string;
  projectId: string;
  permit: {
    id: string;
    permitNumber: string | null;
    type: string;
    status: string;
    jurisdiction: string | null;
    appliedDate: Date | null;
    issuedDate: Date | null;
    expirationDate: Date | null;
    fee: number | null;
    notes: string | null;
    inspections: Inspection[];
  };
  canEdit: boolean;
}

export function PermitCard({ workspaceSlug, projectId, permit, canEdit }: PermitCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const upcoming = permit.inspections.filter(
    (i) => i.result === 'PENDING' && i.scheduledDate && i.scheduledDate.getTime() > Date.now(),
  );
  const overdue = permit.inspections.filter(
    (i) => i.result === 'PENDING' && i.scheduledDate && i.scheduledDate.getTime() < Date.now(),
  );
  const passed = permit.inspections.filter((i) => i.result === 'PASSED');
  const failed = permit.inspections.filter((i) => i.result === 'FAILED');

  return (
    <div className="bg-paper border-2 border-ink overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-cream-2"
      >
        <div className="w-9 h-9 bg-ink text-cream flex items-center justify-center font-black text-sm flex-shrink-0">
          {permit.permitNumber ? permit.permitNumber.slice(0, 2) : 'PR'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-extrabold text-[14px]">{permit.type}</span>
            {permit.permitNumber ? (
              <span className="font-mono text-[11px] text-ink-50">#{permit.permitNumber}</span>
            ) : null}
            {overdue.length > 0 ? (
              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] bg-error text-paper">
                {overdue.length} overdue
              </span>
            ) : null}
            {upcoming.length > 0 ? (
              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] bg-orange text-paper">
                {upcoming.length} upcoming
              </span>
            ) : null}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-0.5">
            {permit.inspections.length} inspection{permit.inspections.length === 1 ? '' : 's'}
            {passed.length > 0 ? ` · ${passed.length} passed` : ''}
            {failed.length > 0 ? ` · ${failed.length} failed` : ''}
            {permit.issuedDate ? ` · issued ${permit.issuedDate.toLocaleDateString()}` : ''}
            {permit.expirationDate ? ` · expires ${permit.expirationDate.toLocaleDateString()}` : ''}
          </div>
        </div>
        <div className="text-ink-50">{expanded ? '−' : '+'}</div>
      </button>

      {expanded ? (
        <div className="border-t-2 border-ink">
          {/* Permit details */}
          <div className="p-4 bg-cream-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            {permit.jurisdiction ? (
              <div>
                <div className="font-mono uppercase tracking-[0.1em] text-ink-50 text-[9px]">Jurisdiction</div>
                <div className="font-extrabold">{permit.jurisdiction}</div>
              </div>
            ) : null}
            {permit.appliedDate ? (
              <div>
                <div className="font-mono uppercase tracking-[0.1em] text-ink-50 text-[9px]">Applied</div>
                <div className="font-extrabold">{permit.appliedDate.toLocaleDateString()}</div>
              </div>
            ) : null}
            {permit.issuedDate ? (
              <div>
                <div className="font-mono uppercase tracking-[0.1em] text-ink-50 text-[9px]">Issued</div>
                <div className="font-extrabold">{permit.issuedDate.toLocaleDateString()}</div>
              </div>
            ) : null}
            {permit.expirationDate ? (
              <div>
                <div className="font-mono uppercase tracking-[0.1em] text-ink-50 text-[9px]">Expires</div>
                <div className="font-extrabold">{permit.expirationDate.toLocaleDateString()}</div>
              </div>
            ) : null}
            {permit.fee ? (
              <div>
                <div className="font-mono uppercase tracking-[0.1em] text-ink-50 text-[9px]">Fee</div>
                <div className="font-extrabold">${Number(permit.fee).toLocaleString()}</div>
              </div>
            ) : null}
          </div>

          {permit.notes ? (
            <div className="px-4 py-3 border-t border-line text-[12px] text-ink-70">
              {permit.notes}
            </div>
          ) : null}

          {/* Inspections list */}
          <div className="border-t border-line">
            <div className="px-4 py-2 flex items-center justify-between bg-paper">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                {'// Inspections'}
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(!showAdd)}
                  className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:underline"
                >
                  {showAdd ? 'Cancel' : '+ Schedule inspection'}
                </button>
              ) : null}
            </div>

            {showAdd && canEdit ? (
              <AddInspectionForm
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                permitId={permit.id}
                onDone={() => setShowAdd(false)}
              />
            ) : null}

            {permit.inspections.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-ink-50">
                No inspections scheduled. {canEdit ? 'Click "Schedule inspection" to add one.' : ''}
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {permit.inspections.map((ins) => (
                  <InspectionRow
                    key={ins.id}
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    permitId={permit.id}
                    inspection={ins}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddInspectionForm({
  workspaceSlug,
  projectId,
  permitId,
  onDone,
}: {
  workspaceSlug: string;
  projectId: string;
  permitId: string;
  onDone: () => void;
}) {
  const [state, formAction] = useFormState(
    (prev: unknown, formData: FormData) =>
      createInspectionAction(workspaceSlug, projectId, permitId, prev as never, formData),
    undefined,
  );
  useEffect(() => {
    if (state && 'ok' in state && state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="p-4 bg-cream-2 border-y border-line space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Type *
          </label>
          <select
            name="type"
            required
            className="w-full px-2 py-1.5 bg-paper border-2 border-ink text-[12px]"
          >
            {Object.entries(INSPECTION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Scheduled date
          </label>
          <input
            type="datetime-local"
            name="scheduledDate"
            className="w-full px-2 py-1.5 bg-paper border-2 border-ink text-[12px]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Inspector name
          </label>
          <input
            type="text"
            name="inspectorName"
            placeholder="e.g. John Smith"
            className="w-full px-2 py-1.5 bg-paper border-2 border-ink text-[12px]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Scheduled by
          </label>
          <input
            type="text"
            name="scheduledBy"
            placeholder="e.g. Sarah, the PM"
            className="w-full px-2 py-1.5 bg-paper border-2 border-ink text-[12px]"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Notes
        </label>
        <input
          type="text"
          name="notes"
          placeholder="e.g. Confirmed with inspector 8am cutoff"
          className="w-full px-2 py-1.5 bg-paper border-2 border-ink text-[12px]"
        />
      </div>
      {'error' in (state ?? {}) && state?.error ? (
        <div className="text-[11px] text-error font-extrabold">{state.error}</div>
      ) : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Scheduling…' : 'Schedule inspection'}
    </button>
  );
}

function InspectionRow({
  workspaceSlug,
  projectId,
  permitId,
  inspection,
  canEdit,
}: {
  workspaceSlug: string;
  projectId: string;
  permitId: string;
  inspection: Inspection;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const overdue =
    inspection.result === 'PENDING' &&
    inspection.scheduledDate &&
    inspection.scheduledDate.getTime() < Date.now();

  function setResult(result: string) {
    start(async () => {
      await updateInspectionResultAction(workspaceSlug, projectId, permitId, inspection.id, result);
    });
  }

  function onDelete() {
    if (!confirm(`Delete this ${INSPECTION_TYPE_LABELS[inspection.type] ?? inspection.type} inspection?`)) return;
    start(async () => {
      await deleteInspectionAction(workspaceSlug, projectId, permitId, inspection.id);
    });
  }

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${pending ? 'opacity-60' : ''} ${overdue ? 'border-l-4 border-l-error' : ''}`}>
      <div className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] ${RESULT_STYLES[inspection.result] ?? 'bg-ink text-paper'} flex-shrink-0`}>
        {INSPECTION_RESULT_LABELS[inspection.result] ?? inspection.result}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-[13px]">
          {INSPECTION_TYPE_LABELS[inspection.type] ?? inspection.type}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {inspection.scheduledDate ? (
            <span>
              scheduled {inspection.scheduledDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : (
            <span>not scheduled</span>
          )}
          {inspection.completedDate ? (
            <span>completed {inspection.completedDate.toLocaleDateString()}</span>
          ) : null}
          {inspection.scheduledBy ? <span>by {inspection.scheduledBy}</span> : null}
        </div>
        {inspection.notes ? (
          <div className="text-[11px] text-ink-70 mt-1 line-clamp-2">{inspection.notes}</div>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex flex-col gap-1 flex-shrink-0">
          <select
            value={inspection.result}
            onChange={(e) => setResult(e.target.value)}
            disabled={pending}
            className="text-[10px] font-mono uppercase tracking-[0.1em] px-2 py-1 bg-paper border border-ink"
          >
            {Object.entries(INSPECTION_RESULT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-30 hover:text-error disabled:opacity-50"
          >
            delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
