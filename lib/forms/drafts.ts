/**
 * Form draft persistence in localStorage. When the user is offline or
 * the network is slow, we save their in-progress form values so they
 * don't lose work. Drafts are scoped per (workspace, form key) and
 * include a timestamp so we can expire old ones.
 */

const STORAGE_KEY = 'udgok.drafts.v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_DRAFTS = 50; // Cap total drafts to avoid blowing out localStorage

export interface Draft<T = Record<string, unknown>> {
  key: string;
  workspaceId: string;
  formKey: string;
  values: T;
  savedAt: number;
}

function readAll(): Draft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Draft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: Draft[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Cap to MAX_DRAFTS, keeping newest
    const trimmed = drafts
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_DRAFTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or disabled — fail silently
  }
}

export function saveDraft<T>(
  workspaceId: string,
  formKey: string,
  values: T,
): void {
  const all = readAll();
  const idx = all.findIndex(
    (d) => d.workspaceId === workspaceId && d.formKey === formKey,
  );
  const draft: Draft<T> = {
    key: `${workspaceId}:${formKey}`,
    workspaceId,
    formKey,
    values,
    savedAt: Date.now(),
  };
  if (idx >= 0) all[idx] = draft as Draft;
  else all.push(draft as Draft);
  writeAll(all);
}

export function loadDraft<T>(
  workspaceId: string,
  formKey: string,
): T | null {
  const all = readAll();
  const draft = all.find(
    (d) => d.workspaceId === workspaceId && d.formKey === formKey,
  );
  if (!draft) return null;
  // Expire old drafts
  if (Date.now() - draft.savedAt > MAX_AGE_MS) {
    deleteDraft(workspaceId, formKey);
    return null;
  }
  return draft.values as T;
}

export function deleteDraft(workspaceId: string, formKey: string): void {
  const all = readAll().filter(
    (d) => !(d.workspaceId === workspaceId && d.formKey === formKey),
  );
  writeAll(all);
}

export function listAllDrafts(workspaceId: string): Draft[] {
  return readAll()
    .filter((d) => d.workspaceId === workspaceId)
    .sort((a, b) => b.savedAt - a.savedAt);
}
