'use client';

import { useState, useTransition } from 'react';
import { draftSubMessageAction } from '@/lib/ai/actions';

interface DraftSubMessageButtonProps {
  workspaceSlug: string;
  projectId: string;
  sub: {
    id: string;
    name: string;
    primaryTrade: string | null;
  };
}

export function DraftSubMessageButton({ workspaceSlug, projectId, sub }: DraftSubMessageButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{
    subject: string;
    body: string;
    confidence: number;
    why: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    setDraft(null);
    setCopied(false);
    start(async () => {
      const result = await draftSubMessageAction(workspaceSlug, projectId, sub.id, {
        trigger: 'manual',
        notes: notes.trim() || undefined,
      });
      if (result.ok && result.draft) {
        setDraft(result.draft);
      } else {
        setError(result.error ?? 'Failed to draft message');
      }
    });
  }

  function copy() {
    if (!draft) return;
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline flex items-center gap-1"
      >
        <span aria-hidden>✦</span> AI draft
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border-2 border-ink w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b-2 border-ink bg-ink text-cream flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange text-paper flex items-center justify-center font-black text-sm">✦</div>
            <h2 className="font-black text-[16px]">AI draft → {sub.name}</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setDraft(null);
              setError(null);
              setNotes('');
            }}
            className="w-8 h-8 -mr-1 flex items-center justify-center hover:bg-cream/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12px] text-ink-70">
            The AI looks at this project&apos;s sub list, schedule of values, tasks, and recent activity, then drafts a short, crew-friendly message in your voice.
          </p>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Add context (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. framing inspection passed, ready for rough-in next Tuesday"
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-orange resize-none"
            />
          </div>

          {!draft ? (
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="w-full px-4 py-3 bg-orange text-paper border-2 border-orange text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d disabled:opacity-50"
            >
              {pending ? 'Drafting…' : '✦ Generate draft'}
            </button>
          ) : null}

          {error ? (
            <div className="space-y-2">
              <div className="text-[12px] text-error bg-error/5 border border-error p-2 leading-relaxed">
                {error}
              </div>
              <button
                type="button"
                onClick={generate}
                disabled={pending}
                className="w-full px-4 py-2.5 border-2 border-error text-error text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-error hover:text-paper disabled:opacity-50"
              >
                {pending ? 'Drafting…' : '↻ Try again'}
              </button>
            </div>
          ) : null}

          {draft ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                <span>Confidence: {draft.confidence}%</span>
                <span>·</span>
                <span>{draft.why}</span>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  readOnly
                  value={draft.subject}
                  className="w-full px-3 py-2.5 bg-cream border-2 border-line text-[14px] font-extrabold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Body
                </label>
                <textarea
                  readOnly
                  value={draft.body}
                  rows={8}
                  className="w-full px-3 py-2.5 bg-cream border-2 border-line text-[13px] leading-relaxed resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="flex-1 px-4 py-2.5 bg-ink text-paper border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange hover:border-orange"
                >
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={pending}
                  className="px-4 py-2.5 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream"
                >
                  {pending ? '…' : 'Regenerate'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
