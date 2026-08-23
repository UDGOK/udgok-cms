'use client';

import { useState, useTransition } from 'react';
import { publicAnswerRfiAction } from '@/lib/submittals/actions';

export function PublicRfiActions({ token }: { token: string }) {
  const [answer, setAnswer] = useState('');
  const [answeredByName, setAnsweredByName] = useState('');
  const [answeredByEmail, setAnsweredByEmail] = useState('');
  const [costImpact, setCostImpact] = useState(false);
  const [costImpactAmount, setCostImpactAmount] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState(false);
  const [scheduleImpactDays, setScheduleImpactDays] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!answeredByName.trim()) {
      setError('Please type your name');
      return;
    }
    if (!answer.trim()) {
      setError('Please provide a response');
      return;
    }
    startTransition(async () => {
      const res = await publicAnswerRfiAction({
        token,
        answer,
        answeredByName,
        answeredByEmail: answeredByEmail || null,
        costImpact,
        costImpactAmount: costImpact && costImpactAmount ? Number(costImpactAmount) : null,
        scheduleImpact,
        scheduleImpactDays: scheduleImpact ? Number(scheduleImpactDays) || 0 : 0,
      });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="border-2 border-line p-5 space-y-4">
      <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em]">Respond to this RFI</h2>

      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Your response <span className="text-error">*</span></span>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={6}
          maxLength={8000}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
          required
          placeholder="Answer the question thoroughly. Reference drawings, specs, or submittals as needed."
        />
      </label>

      <div className="border-t border-line pt-4 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70">Impact</h3>
        <p className="text-xs text-ink-60">
          If your response creates a cost or schedule change, flag it. The GC
          will use this to prepare a Change Order.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={costImpact}
            onChange={(e) => setCostImpact(e.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <span>Cost impact</span>
            {costImpact ? (
              <input
                type="number"
                value={costImpactAmount}
                onChange={(e) => setCostImpactAmount(e.target.value)}
                placeholder="Estimated $ impact"
                step="0.01"
                className="block w-full mt-1 px-2 py-1 border-2 border-line bg-paper tabular-nums font-mono"
              />
            ) : null}
          </div>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={scheduleImpact}
            onChange={(e) => setScheduleImpact(e.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <span>Schedule impact</span>
            {scheduleImpact ? (
              <input
                type="number"
                value={scheduleImpactDays}
                onChange={(e) => setScheduleImpactDays(e.target.value)}
                placeholder="Days"
                min="0"
                step="1"
                className="block w-32 mt-1 px-2 py-1 border-2 border-line bg-paper tabular-nums font-mono"
              />
            ) : null}
          </div>
        </label>
      </div>

      <div className="border-t border-line pt-4 space-y-3">
        <label className="block text-sm">
          <span className="block text-ink-70 mb-1">Your name <span className="text-error">*</span></span>
          <input
            type="text"
            value={answeredByName}
            onChange={(e) => setAnsweredByName(e.target.value)}
            className="w-full px-3 py-2 border-2 border-line bg-paper"
            required
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-70 mb-1">Email <span className="text-ink-50">(optional)</span></span>
          <input
            type="email"
            value={answeredByEmail}
            onChange={(e) => setAnsweredByEmail(e.target.value)}
            className="w-full px-3 py-2 border-2 border-line bg-paper"
            autoComplete="email"
          />
        </label>
      </div>

      {error ? <p className="text-error text-sm">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50"
      >
        {isPending ? 'Submitting…' : 'Submit response'}
      </button>
    </form>
  );
}
