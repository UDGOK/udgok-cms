'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Field, Input } from '@/components/ui';
import { renameWorkspaceAction, deleteWorkspaceAction, inviteMemberAction } from '@/lib/workspace/management';
import { exportWorkspaceAction, importWorkspaceAction } from '@/lib/workspace/backup';

function SaveBtn() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="copper" size="sm" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>;
}

function InviteBtn() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="copper" size="sm" disabled={pending}>{pending ? 'Sending…' : 'Send invite'}</Button>;
}

export function WorkspaceSettingsForm({
  workspaceSlug,
  initialName,
  initialIndustry,
}: {
  workspaceSlug: string;
  initialName: string;
  initialIndustry: string | null;
}) {
  const [state, formAction] = useFormState(
    renameWorkspaceAction.bind(null, workspaceSlug),
    undefined as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  );

  if (state?.ok && typeof window !== 'undefined') {
    setTimeout(() => window.location.reload(), 0);
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" htmlFor="w-name" error={state?.fieldErrors?.name}>
          <Input id="w-name" name="name" required defaultValue={initialName} />
        </Field>
        <Field label="Industry" htmlFor="w-industry">
          <Input id="w-industry" name="industry" defaultValue={initialIndustry ?? ''} placeholder="General construction, plumbing, etc." />
        </Field>
      </div>
      {state?.error && !state.fieldErrors ? <p className="text-sm text-error font-semibold">{state.error}</p> : null}
      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}

export function InviteMemberForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, formAction] = useFormState(
    inviteMemberAction.bind(null, workspaceSlug),
    undefined as { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined,
  );
  const [open, setOpen] = useState(false);

  if (state?.ok) {
    setTimeout(() => {
      setOpen(false);
      if (typeof window !== 'undefined') window.location.reload();
    }, 0);
  }

  if (!open) {
    return <Button variant="copper" onClick={() => setOpen(true)}>+ Invite member</Button>;
  }

  return (
    <form action={formAction} className="bg-cream-2 border border-line p-3 flex items-end gap-2">
      <div className="flex-1">
        <Field label="Email" htmlFor="invite-email" error={state?.fieldErrors?.email}>
          <Input id="invite-email" name="email" type="email" required placeholder="contractor@example.com" autoFocus />
        </Field>
      </div>
      <div>
        <Field label="Role" htmlFor="invite-role">
          <select id="invite-role" name="role" defaultValue="MEMBER" className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink">
            <option value="ADMIN">Admin</option>
            <option value="PM">PM</option>
            <option value="ESTIMATOR">Estimator</option>
            <option value="FIELD">Field</option>
            <option value="MEMBER">Member</option>
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <InviteBtn />
      </div>
    </form>
  );
}

export function BackupSection({ workspaceSlug }: { workspaceSlug: string }) {
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: { clients: number; projects: number; payApps: number } } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const router = useRouter();

  async function handleExport() {
    const result = await exportWorkspaceAction(workspaceSlug);
    if (result.error || !result.data) {
      alert('Export failed: ' + (result.error ?? 'unknown'));
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspaceSlug}-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.set('json', importText);
      fd.set('mode', importMode);
      const result = await importWorkspaceAction(workspaceSlug, undefined, fd);
      if (result?.error) {
        setImportError(result.error);
      } else if (result?.ok) {
        const imported = result.imported ?? { clients: 0, projects: 0, payApps: 0 };
        setImportResult({ imported });
        setImportText('');
        setTimeout(() => router.refresh(), 1500);
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-paper border-2 border-line p-6 mb-6">
      <div className="label-eyebrow mb-3">{'// Backup & restore'}</div>
      <p className="text-[12px] text-ink-70 mb-4">
        Export all your workspace data as a JSON file. You can restore from a backup at any time.
        Use <strong>Merge</strong> to add new records without overwriting, or <strong>Replace</strong> to wipe and restore.
      </p>

      <div className="flex gap-2 mb-4">
        <Button variant="copper" onClick={handleExport}>
          ↓ Download backup
        </Button>
        <Button variant="ghost" onClick={() => setImportOpen(!importOpen)}>
          {importOpen ? 'Cancel import' : '↑ Restore from backup'}
        </Button>
      </div>

      {importOpen ? (
        <div className="bg-cream-2 border border-line p-4 space-y-3">
          <div>
            <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
              Paste your backup JSON
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder='{"schemaVersion": 1, "workspace": {...}, "clients": [...], "projects": [...] }'
              className="block w-full px-3 py-2 bg-paper border border-line text-ink text-[11px] font-mono outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
              Mode
            </label>
            <div className="flex gap-3 text-[12px]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" value="merge" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="accent-orange" />
                <span><strong>Merge</strong> — add new, skip duplicates</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="accent-orange" />
                <span><strong>Replace</strong> — wipe and restore (destructive)</span>
              </label>
            </div>
          </div>

          {importError ? <p className="text-sm text-error font-semibold">{importError}</p> : null}
          {importResult ? (
            <p className="text-sm text-success font-semibold">
              ✓ Imported {importResult.imported.clients} clients, {importResult.imported.projects} projects, {importResult.imported.payApps} pay apps
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>Cancel</Button>
            <Button
              variant="copper"
              onClick={handleImport}
              disabled={importing || !importText.trim()}
              className={importMode === 'replace' ? 'bg-error border-error text-paper' : ''}
            >
              {importing ? 'Importing…' : importMode === 'replace' ? 'Wipe & restore' : 'Restore'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DeleteWorkspaceSection({ workspaceSlug, workspaceName }: { workspaceSlug: string; workspaceName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  if (!confirming) {
    return (
      <div className="bg-paper border-2 border-error/30 p-5">
        <h3 className="font-extrabold text-[14px] mb-1">Danger zone</h3>
        <p className="text-[12px] text-ink-70 mb-3">
          Deleting {workspaceName} permanently removes all clients, projects, pay apps, files, and team memberships.
        </p>
        <Button variant="ghost" onClick={() => setConfirming(true)} className="text-error border-error/40 hover:bg-error/5">
          Delete this workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-error/5 border-2 border-error p-5">
      <h3 className="font-extrabold text-[14px] text-error mb-1">Type the workspace name to confirm</h3>
      <p className="text-[12px] text-ink-70 mb-3">
        Type <span className="font-mono font-extrabold text-ink">{workspaceName}</span> below to enable the delete button.
      </p>
      <input
        type="text"
        id="confirm-ws"
        onChange={(e) => {
          const btn = document.getElementById('confirm-ws-btn') as HTMLButtonElement | null;
          if (btn) btn.disabled = e.target.value !== workspaceName;
        }}
        className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-error mb-3"
        placeholder={workspaceName}
      />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>Cancel</Button>
        <Button
          id="confirm-ws-btn"
          variant="copper"
          disabled
          onClick={async () => {
            setDeleting(true);
            await deleteWorkspaceAction(workspaceSlug);
            router.push('/workspaces');
          }}
          className="bg-error border-error text-paper disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete forever'}
        </Button>
      </div>
    </div>
  );
}
