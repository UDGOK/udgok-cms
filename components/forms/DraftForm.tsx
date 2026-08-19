'use client';

import { useEffect, useRef, useState } from 'react';
import { loadDraft, saveDraft, deleteDraft, listAllDrafts } from '@/lib/forms/drafts';
import { RelativeTime } from '@/components/ui/RelativeTime';

interface DraftFormProps<T extends Record<string, unknown>> {
  workspaceId: string;
  formKey: string;
  initialValues: T;
  onSubmit: (values: T) => void | Promise<void>;
  children: (props: {
    values: T;
    setValues: (v: T) => void;
    clearDraft: () => void;
    draftSavedAt: number | null;
    isOnline: boolean;
  }) => React.ReactNode;
  /** If true, only persist draft when offline (defaults to always). */
  offlineOnly?: boolean;
}

/**
 * Wraps any form with auto-save to localStorage. Restores the draft on
 * mount if one exists. Shows a "Draft saved Xs ago" indicator + a
 * "Clear draft" button when one is loaded.
 */
export function DraftForm<T extends Record<string, unknown>>({
  workspaceId,
  formKey,
  initialValues,
  onSubmit,
  children,
  offlineOnly = false,
}: DraftFormProps<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const initialDraftRef = useRef<T | null>(null);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft<T>(workspaceId, formKey);
    if (draft) {
      initialDraftRef.current = draft;
      setValues(draft);
      setDraftSavedAt(Date.now()); // approximate
    }
    setIsHydrated(true);
  }, [workspaceId, formKey]);

  // Online/offline tracking
  useEffect(() => {
    setIsOnline(navigator.onLine);
    function on() { setIsOnline(true); }
    function off() { setIsOnline(false); }
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Auto-save (debounced)
  useEffect(() => {
    if (!isHydrated) return;
    if (offlineOnly && isOnline) return;
    const t = setTimeout(() => {
      saveDraft(workspaceId, formKey, values);
      setDraftSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(t);
  }, [values, workspaceId, formKey, isHydrated, isOnline, offlineOnly]);

  function clearDraft() {
    deleteDraft(workspaceId, formKey);
    setValues(initialValues);
    setDraftSavedAt(null);
  }

  async function handleSubmit() {
    await onSubmit(values);
    // Clear the draft on successful submit
    deleteDraft(workspaceId, formKey);
    setDraftSavedAt(null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      {children({ values, setValues, clearDraft, draftSavedAt, isOnline })}

      {draftSavedAt ? (
        <div className="mt-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.05em] text-ink-50">
          <span className="w-1.5 h-1.5 bg-success rounded-full" />
          <span>Draft saved <RelativeTime iso={new Date(draftSavedAt).toISOString()} /></span>
          <button
            type="button"
            onClick={clearDraft}
            className="text-orange-d hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}
    </form>
  );
}

/**
 * A small panel that lists all in-progress drafts for the current
 * workspace. Place it on a "Drafts" page or in a sidebar so users
 * can resume work later.
 */
export function DraftList({ workspaceId }: { workspaceId: string }) {
  const [drafts, setDrafts] = useState(listAllDrafts(workspaceId));

  useEffect(() => {
    setDrafts(listAllDrafts(workspaceId));
    function onStorage() { setDrafts(listAllDrafts(workspaceId)); }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [workspaceId]);

  if (drafts.length === 0) {
    return (
      <div className="text-center text-ink-50 text-[12px] py-6">
        No drafts saved. Any form you fill out will be auto-saved as a draft.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {drafts.map((d) => (
        <li key={d.key} className="py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-[13px] truncate">{d.formKey}</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink-50 mt-0.5">
              <RelativeTime iso={new Date(d.savedAt).toISOString()} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              deleteDraft(d.workspaceId, d.formKey);
              setDrafts(listAllDrafts(workspaceId));
            }}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-error hover:underline flex-shrink-0"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
