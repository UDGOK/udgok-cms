'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { convertDealToProjectAction } from '@/lib/projects/actions';

/**
 * "Convert to project" / "Open project" button for the deal
 * detail page. Three states:
 *
 *   1. The deal has no project yet → button is enabled, label is
 *      "Convert to project". On click, calls the action and
 *      navigates to the new project.
 *   2. The deal is already converted → button is a link to the
 *      existing project (label "Open project"). The action's
 *      idempotency also handles this if the user clicks again
 *      from a stale tab.
 *   3. Click in flight → button disabled, label is busy.
 *
 * Lives as a client component because the action returns an id
 * and we need router.push() to navigate. The server component
 * that owns this button only passes the deal id + workspace
 * slug.
 */
export function ConvertToProjectButton({
  workspaceSlug,
  dealId,
  convertedProjectId,
  convertedProjectName,
}: {
  workspaceSlug: string;
  dealId: string;
  convertedProjectId: string | null;
  convertedProjectName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (convertedProjectId) {
    return (
      <a
        href={`/w/${workspaceSlug}/projects/${convertedProjectId}`}
        className="block w-full text-center px-4 py-3 bg-ink text-paper text-xs font-extrabold uppercase tracking-[0.1em] hover:bg-ink/90 transition-colors"
      >
        ✓ Open project{convertedProjectName ? ` · ${convertedProjectName}` : ''}
      </a>
    );
  }

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await convertDealToProjectAction(workspaceSlug, dealId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/w/${workspaceSlug}/projects/${res.projectId}`);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-full px-4 py-3 bg-orange text-paper text-xs font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d transition-colors disabled:opacity-50"
      >
        {pending ? '⟳ Converting…' : '+ Convert to project'}
      </button>
      {error ? (
        <p className="mt-2 text-[11px] font-mono text-error">{error}</p>
      ) : null}
    </div>
  );
}
