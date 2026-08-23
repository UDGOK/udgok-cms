'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRfiAction } from '@/lib/submittals/actions';

export function NewRfiButton({
  projectId,
  workspaceSlug,
  primary = false,
}: {
  projectId: string;
  workspaceSlug: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [costImpact, setCostImpact] = useState(false);
  const [scheduleImpact, setScheduleImpact] = useState(false);

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setSubject('');
    setQuestion('');
    setDueDate('');
    setCostImpact(false);
    setScheduleImpact(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !question.trim()) {
      setError('Subject and question are required');
      return;
    }
    startTransition(async () => {
      const res = await createRfiAction({
        workspaceSlug,
        projectId,
        subject: subject.trim(),
        question: question.trim(),
        dueDate: dueDate || null,
        costImpact,
        scheduleImpact,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          primary
            ? 'px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm'
            : 'px-4 py-2 bg-ink text-paper font-bold uppercase tracking-wider text-sm whitespace-nowrap'
        }
      >
        + New RFI
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={submit} className="bg-paper border-2 border-ink w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between sticky top-0 bg-paper z-10">
              <h2 className="text-lg font-extrabold">New RFI</h2>
              <button type="button" onClick={close} disabled={isPending} className="text-ink-70 text-2xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Subject <span className="text-error">*</span></span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                  required
                  maxLength={200}
                  placeholder="e.g. Ceiling height at lobby — Drawing A-501 vs spec"
                />
              </label>
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Question <span className="text-error">*</span></span>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={5}
                  maxLength={8000}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                  required
                  placeholder="State the question clearly. Reference drawings, specs, or submittals by number."
                />
              </label>
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Response needed by</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                />
              </label>
              <div className="text-[11px] text-ink-60">
                Flag <em>expected</em> impacts if you know them. The architect can
                confirm or correct on the response.
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={costImpact} onChange={(e) => setCostImpact(e.target.checked)} />
                <span>Expected cost impact</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scheduleImpact} onChange={(e) => setScheduleImpact(e.target.checked)} />
                <span>Expected schedule impact</span>
              </label>
              {error ? <p className="text-error text-sm">{error}</p> : null}
            </div>
            <div className="px-6 py-4 border-t-2 border-ink flex justify-end gap-2 sticky bottom-0 bg-paper">
              <button type="button" onClick={close} disabled={isPending} className="px-4 py-2 text-ink-70 text-sm">Cancel</button>
              <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50">
                {isPending ? 'Creating…' : 'Create RFI (DRAFT)'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
