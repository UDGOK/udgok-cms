'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSubmittalAction } from '@/lib/submittals/actions';

interface SubLite { id: string; name: string }

export function NewSubmittalButton({
  projectId,
  workspaceSlug,
  subcontractorOptions,
  primary = false,
}: {
  projectId: string;
  workspaceSlug: string;
  subcontractorOptions: SubLite[];
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [specSection, setSpecSection] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [requiredByDate, setRequiredByDate] = useState('');

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setSpecSection('');
    setTitle('');
    setDescription('');
    setSubcontractorId('');
    setRequiredByDate('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!specSection.trim() || !title.trim()) {
      setError('Spec section and title are required');
      return;
    }
    startTransition(async () => {
      const res = await createSubmittalAction({
        workspaceSlug,
        projectId,
        specSection: specSection.trim(),
        title: title.trim(),
        description: description.trim() || null,
        subcontractorId: subcontractorId || null,
        requiredByDate: requiredByDate || null,
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
        + New submittal
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={submit} className="bg-paper border-2 border-ink w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between sticky top-0 bg-paper z-10">
              <h2 className="text-lg font-extrabold">New submittal</h2>
              <button type="button" onClick={close} disabled={isPending} className="text-ink-70 text-2xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">
                  CSI spec section <span className="text-error">*</span>
                </span>
                <input
                  type="text"
                  value={specSection}
                  onChange={(e) => setSpecSection(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper font-mono"
                  placeholder="e.g. 09 65 19 (resilient floor)"
                  required
                  maxLength={20}
                />
                <p className="text-[11px] text-ink-60 mt-1">
                  MasterFormat section number. Per-section sequence auto-increments
                  so you&apos;ll see <span className="font-mono">09 65 19-001</span> on
                  the printable form.
                </p>
              </label>
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Title <span className="text-error">*</span></span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                  required
                  maxLength={200}
                  placeholder="e.g. Shaw Contract LVT — Color Sample"
                />
              </label>
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                  placeholder="What is being submitted, and what needs to be reviewed."
                />
              </label>
              {subcontractorOptions.length > 0 ? (
                <label className="block text-sm">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">Submitted by</span>
                  <select
                    value={subcontractorId}
                    onChange={(e) => setSubcontractorId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-line bg-paper"
                  >
                    <option value="">(internal / not from a sub)</option>
                    {subcontractorOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-70 mb-1">
                  Required by date <span className="text-ink-50">(when does the architect need to respond?)</span>
                </span>
                <input
                  type="date"
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-line bg-paper"
                />
              </label>
              {error ? <p className="text-error text-sm">{error}</p> : null}
              <p className="text-xs text-ink-60">
                After creation, you&apos;ll get a public link to send to the
                architect/engineer. They can stamp APPROVED, APPROVED AS NOTED,
                REVISE & RESUBMIT, or REJECTED without logging in.
              </p>
            </div>
            <div className="px-6 py-4 border-t-2 border-ink flex justify-end gap-2 sticky bottom-0 bg-paper">
              <button type="button" onClick={close} disabled={isPending} className="px-4 py-2 text-ink-70 text-sm">Cancel</button>
              <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-ink text-paper font-bold uppercase tracking-wider text-sm disabled:opacity-50">
                {isPending ? 'Creating…' : 'Create submittal (DRAFT)'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
