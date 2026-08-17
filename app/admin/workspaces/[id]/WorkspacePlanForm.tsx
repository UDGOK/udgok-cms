'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Plan } from '@prisma/client';
import { setWorkspacePlanAction } from '@/lib/admin/actions';
import { PLAN_INFO } from '@/lib/workspace/tier';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Change plan'}
    </button>
  );
}

export function WorkspacePlanForm({
  workspaceId,
  currentPlan,
}: {
  workspaceId: string;
  currentPlan: Plan;
}) {
  const [state, formAction] = useFormState(setWorkspacePlanAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
          Set plan
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['STARTER', 'PRO', 'ENTERPRISE'] as const).map((p) => {
            const info = PLAN_INFO[p];
            const isCurrent = p === currentPlan;
            return (
              <label
                key={p}
                className={`block cursor-pointer p-3 border-2 text-center transition-colors ${
                  isCurrent
                    ? 'border-orange bg-cream-2'
                    : 'border-line bg-paper hover:border-ink'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={p}
                  defaultChecked={isCurrent}
                  className="sr-only"
                />
                <div className="font-extrabold text-[12px] uppercase tracking-[0.05em]">{info.label}</div>
                <div className="text-[10px] font-mono text-ink-50 mt-1">{info.price}</div>
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.ok ? (
          <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-success">✓ Plan updated</span>
        ) : null}
        {state?.error ? (
          <span className="text-[11px] font-mono text-error">{state.error}</span>
        ) : null}
      </div>
      <p className="text-[10px] text-ink-50 leading-snug">
        Changing the plan takes effect immediately. The workspace owner and members
        will see the new tier on their next page load.
      </p>
    </form>
  );
}
