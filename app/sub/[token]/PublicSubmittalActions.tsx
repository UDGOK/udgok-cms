'use client';

import { useState, useTransition } from 'react';
import { publicReviewSubmittalAction } from '@/lib/submittals/actions';

export function PublicSubmittalActions({ token }: { token: string }) {
  const [disposition, setDisposition] = useState<'APPROVED' | 'APPROVED_AS_NOTED' | 'REVISE_AND_RESUBMIT' | 'REJECTED'>('APPROVED');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reviewerName.trim()) {
      setError('Please type your name');
      return;
    }
    startTransition(async () => {
      const res = await publicReviewSubmittalAction({
        token,
        disposition,
        reviewerName,
        reviewerEmail: reviewerEmail || null,
        reviewNotes: notes || null,
      });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="border-2 border-line p-5 space-y-4">
      <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em]">Stamp this submittal</h2>

      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-2">Disposition</legend>
        {(['APPROVED', 'APPROVED_AS_NOTED', 'REVISE_AND_RESUBMIT', 'REJECTED'] as const).map((d) => (
          <label key={d} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="disposition"
              value={d}
              checked={disposition === d}
              onChange={() => setDisposition(d)}
              className="mt-1"
            />
            <div>
              <div className="font-semibold">{d.replace(/_/g, ' ')}</div>
              <div className="text-xs text-ink-70">
                {d === 'APPROVED' && 'Fabricate / install per the attached documents.'}
                {d === 'APPROVED_AS_NOTED' && 'Proceed, but incorporate the comments below.'}
                {d === 'REVISE_AND_RESUBMIT' && 'Do not fabricate. Resubmit with the corrections noted.'}
                {d === 'REJECTED' && 'This submittal is not acceptable for this project.'}
              </div>
            </div>
          </label>
        ))}
      </fieldset>

      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Your name <span className="text-error">*</span></span>
        <input
          type="text"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
          required
          autoComplete="name"
        />
      </label>
      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Email <span className="text-ink-50">(optional)</span></span>
        <input
          type="email"
          value={reviewerEmail}
          onChange={(e) => setReviewerEmail(e.target.value)}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
          autoComplete="email"
        />
      </label>
      <label className="block text-sm">
        <span className="block text-ink-70 mb-1">Notes / comments <span className="text-ink-50">(optional, recommended for REVISE)</span></span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full px-3 py-2 border-2 border-line bg-paper"
        />
      </label>

      {error ? <p className="text-error text-sm">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50"
      >
        {isPending ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
