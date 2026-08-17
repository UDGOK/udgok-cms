'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { uploadFileAction } from '@/lib/files/actions';
import { Button } from '@/components/ui';

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
}: {
  workspaceSlug: string;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(uploadFileAction.bind(null, workspaceSlug), undefined);

  return (
    <form action={formAction} className="bg-paper border-2 border-line p-6 mb-6">
      <div className="label-eyebrow mb-3">{'// Upload'}</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <input
          type="file"
          name="file"
          required
          className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-ink file:text-cream file:font-extrabold file:uppercase file:tracking-[0.1em] file:text-[10px]"
        />
        <select
          name="clientId"
          className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm"
        >
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          name="projectId"
          className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <SubmitButton />
      </div>
      <input
        type="text"
        name="category"
        placeholder="Category (e.g. contract, photo, drawing)"
        className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm"
      />
      {state?.error ? (
        <p className="text-sm text-error font-semibold mt-2">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success font-semibold mt-2">Uploaded.</p>
      ) : null}
    </form>
  );
}
