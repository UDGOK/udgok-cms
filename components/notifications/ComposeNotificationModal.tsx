'use client';

/**
 * ComposeNotificationModal — the "Send alert" form.
 *
 * Launched from the bell's "+ Send alert" button
 * (only visible to OWNER / ADMIN / PM / FIELD). The
 * user picks a title, optional body, optional link,
 * and a recipient scope (all members or a specific
 * role).
 *
 * On submit, calls pushNotificationAction (a server
 * action). The action fans out one Notification row
 * per recipient. The modal shows the result count
 * ("Sent to 8 members") and auto-closes on success.
 */

import { useEffect, useRef, useState } from 'react';
import {
  pushNotificationAction,
  type PushResult,
} from '@/lib/notifications/actions';
import type { PushRecipientScope } from '@/lib/notifications/types';

interface ComposeNotificationModalProps {
  workspaceId: string;
  workspaceSlug: string;
  members: Array<{ id: string; name: string; role: string }>;
  onClose: () => void;
  onSent: () => void;
}

export function ComposeNotificationModal({
  workspaceSlug,
  members,
  onClose,
  onSent,
}: ComposeNotificationModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [scope, setScope] = useState<PushRecipientScope>({ kind: 'all' });
  const [state, setState] = useState<PushResult | undefined>();
  const [pending, setPending] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);

  // Focus the title field on open so the user can
  // start typing immediately.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Compute the recipient count preview from the
  // current scope. We use this both for the live
  // preview line ("→ 8 members") and for the
  // disable-the-send-button logic (a scope with
  // zero members shouldn't be sendable).
  const recipientCount =
    scope.kind === 'all'
      ? members.length
      : members.filter((m) => m.role === scope.role).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const fd = new FormData();
    fd.set('workspaceSlug', workspaceSlug);
    fd.set('type', 'team_push');
    fd.set('title', title);
    if (body) fd.set('body', body);
    if (link) fd.set('link', link);
    fd.set('recipientScope', JSON.stringify(scope));
    const result = await pushNotificationAction(undefined, fd);
    setState(result);
    setPending(false);
    if (result.ok) {
      // Show the success state for 1 second so the
      // user sees "Sent to 8 members" before the
      // modal closes.
      setTimeout(() => {
        onSent();
      }, 1000);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink/30 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        // Close on backdrop click.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Send an alert to your team"
        className="
          w-full max-w-md
          bg-paper border-2 border-ink
          shadow-[4px_4px_0_0_var(--ink)]
        "
      >
        {/* Header */}
        <div className="px-4 py-3 border-b-2 border-ink bg-cream flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
              Send alert
            </div>
            <div className="text-[14px] font-extrabold text-ink mt-0.5">
              Push to your team
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center text-ink-50 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {state?.ok ? (
          <div className="px-4 py-8 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">✓</div>
            <div className="text-[14px] font-extrabold text-ink">
              Sent to {state.recipientCount} member{state.recipientCount === 1 ? '' : 's'}
            </div>
            <div className="text-[11px] text-ink-50 mt-1">
              Your alert will show up in their bell.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
            <Field
              label="Title"
              error={state && !state.ok ? state.fieldErrors?.title : undefined}
            >
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Crew meeting at 7am tomorrow"
                maxLength={120}
                required
                className="
                  w-full px-2.5 py-1.5
                  bg-cream border border-line
                  text-[13px] text-ink
                  focus:outline-none focus:border-ink
                "
              />
            </Field>

            <Field
              label="Body (optional)"
              error={state && !state.ok ? state.fieldErrors?.body : undefined}
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Bring PPE and your hard hat — owner walkthrough at 8."
                maxLength={500}
                rows={3}
                className="
                  w-full px-2.5 py-1.5
                  bg-cream border border-line
                  text-[13px] text-ink resize-none
                  focus:outline-none focus:border-ink
                "
              />
            </Field>

            <Field
              label="Link (optional)"
              error={state && !state.ok ? state.fieldErrors?.link : undefined}
            >
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/projects/cmt... or full URL"
                maxLength={500}
                className="
                  w-full px-2.5 py-1.5
                  bg-cream border border-line
                  text-[12px] font-mono text-ink
                  focus:outline-none focus:border-ink
                "
              />
              <div className="text-[9px] text-ink-50 mt-1">
                Workspace-relative path (e.g. /projects/abc) or a full URL.
                Leave blank to just mark the alert as read on click.
              </div>
            </Field>

            <Field label="Recipients">
              <div className="space-y-1.5">
                <ScopeOption
                  selected={scope.kind === 'all'}
                  onSelect={() => setScope({ kind: 'all' })}
                  label="All members"
                  count={members.length}
                />
                <ScopeOption
                  selected={scope.kind === 'role' && scope.role === 'OWNER'}
                  onSelect={() => setScope({ kind: 'role', role: 'OWNER' })}
                  label="Owners only"
                  count={members.filter((m) => m.role === 'OWNER').length}
                />
                <ScopeOption
                  selected={scope.kind === 'role' && scope.role === 'ADMIN'}
                  onSelect={() => setScope({ kind: 'role', role: 'ADMIN' })}
                  label="Admins"
                  count={members.filter((m) => m.role === 'ADMIN').length}
                />
                <ScopeOption
                  selected={scope.kind === 'role' && scope.role === 'PM'}
                  onSelect={() => setScope({ kind: 'role', role: 'PM' })}
                  label="Project managers"
                  count={members.filter((m) => m.role === 'PM').length}
                />
                <ScopeOption
                  selected={scope.kind === 'role' && scope.role === 'FIELD'}
                  onSelect={() => setScope({ kind: 'role', role: 'FIELD' })}
                  label="Field crew"
                  count={members.filter((m) => m.role === 'FIELD').length}
                />
              </div>
            </Field>

            {state && !state.ok && !state.fieldErrors ? (
              <div className="text-[11px] text-error font-mono bg-error/10 border border-error px-2 py-1.5">
                {state.error}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                {recipientCount === 0
                  ? 'No recipients in this scope'
                  : `\u2192 ${recipientCount} member${recipientCount === 1 ? '' : 's'}`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="
                    px-3 py-1.5
                    text-[10px] font-extrabold uppercase tracking-[0.12em]
                    text-ink-70 hover:text-ink
                  "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || recipientCount === 0 || title.trim().length === 0}
                  className="
                    px-3 py-1.5
                    bg-orange text-paper
                    text-[10px] font-extrabold uppercase tracking-[0.12em]
                    border-2 border-orange
                    hover:bg-orange-d disabled:opacity-50
                  "
                >
                  {pending ? 'Sending\u2026' : 'Send'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-1">
        {label}
      </div>
      {children}
      {error ? (
        <div className="text-[10px] text-error font-mono mt-1">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function ScopeOption({
  selected,
  onSelect,
  label,
  count,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full flex items-center justify-between
        px-2.5 py-1.5
        border ${selected ? 'border-ink bg-cream-2' : 'border-line bg-cream'}
        text-[12px] text-left
        hover:border-ink
      `}
    >
      <span className="flex items-center gap-2">
        <span
          className={`
            w-3 h-3 rounded-full border-2
            ${selected ? 'border-ink bg-ink' : 'border-ink-50 bg-paper'}
          `}
          aria-hidden="true"
        />
        <span className={selected ? 'font-extrabold text-ink' : 'text-ink-70'}>
          {label}
        </span>
      </span>
      <span className="text-[10px] font-mono text-ink-50">
        {count}
      </span>
    </button>
  );
}
