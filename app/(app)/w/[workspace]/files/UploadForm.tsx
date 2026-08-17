'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { uploadFileAction } from '@/lib/files/actions';
import { Button } from '@/components/ui';

const CATEGORIES = [
  { id: 'brochures',   label: 'Brochures' },
  { id: 'marketing',   label: 'Marketing' },
  { id: 'floorplans',  label: 'Floorplans' },
  { id: 'contracts',   label: 'Contracts' },
  { id: 'site_photos', label: 'Site Photos' },
  { id: 'submittals',  label: 'Submittals' },
  { id: 'invoices',    label: 'Invoices' },
  { id: 'drawings',    label: 'Drawings' },
  { id: 'other',       label: 'Other' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="copper" disabled={pending}>
      {pending ? 'Uploading…' : 'Upload file'}
    </Button>
  );
}

export function UploadForm({
  workspaceSlug,
  clients,
  projects,
  defaultCategory,
}: {
  workspaceSlug: string;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  defaultCategory?: string;
}) {
  const [state, formAction] = useFormState(uploadFileAction.bind(null, workspaceSlug), undefined);

  return (
    <form action={formAction} className="bg-paper border-2 border-ink p-6">
      <div className="text-[9px] font-mono font-extrabold tracking-[0.18em] text-ink-50 uppercase mb-4">
        {'// Upload a new file'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            File
          </label>
          <input
            type="file"
            name="file"
            required
            className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-ink file:text-cream file:font-extrabold file:uppercase file:tracking-[0.1em] file:text-[10px]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            Category
          </label>
          <select
            name="category"
            defaultValue={defaultCategory ?? ''}
            className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm"
          >
            <option value="">— Pick a category —</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            Link to client
          </label>
          <select name="clientId" className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm">
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            Link to project
          </label>
          <select name="projectId" className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm">
            <option value="">— None —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>

      {state?.error ? <p className="text-sm text-error font-semibold mt-2">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-success font-semibold mt-2">Uploaded.</p> : null}
    </form>
  );
}
