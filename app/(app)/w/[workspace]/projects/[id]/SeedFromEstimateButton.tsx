'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { seedFromEstimateAction } from '@/lib/estimates/actions';

/**
 * Retroactive "Seed from estimate" button.
 *
 * For projects that were converted from an estimate
 * BEFORE the convert action learned to seed
 * ProjectDivision + Task rows from the line items.
 * Re-runs the line-item seeding so the schedule of
 * values + tasks show up on the project page.
 *
 * Renders nothing if there's no source estimate
 * (e.g. projects created from a won deal).
 */
export function SeedFromEstimateButton({
  workspaceSlug,
  projectId,
  hasSourceEstimate,
}: {
  workspaceSlug: string;
  projectId: string;
  hasSourceEstimate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!hasSourceEstimate) return null;

  function handleClick() {
    if (
      !confirm(
        'Re-seed this project from the source estimate? This will replace the schedule of values and add any missing tasks. Existing tasks are kept.',
      )
    ) return;
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set('projectId', projectId);
    startTransition(async () => {
      const res = await seedFromEstimateAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        setSuccess(
          `Seeded ${res.divisionCount ?? 0} division${res.divisionCount === 1 ? '' : 's'} and ${res.taskCount ?? 0} task${res.taskCount === 1 ? '' : 's'}.`,
        );
        router.refresh();
      } else {
        setError(res.error ?? 'Seed failed');
      }
    });
  }

  return (
    <div className="bg-paper border-2 border-orange p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange font-bold mb-1">
        ⚠ Estimate-seed missing
      </div>
      <div className="text-[12px] text-ink mb-3">
        This project was converted from an estimate, but the line items weren&apos;t
        seeded into the schedule of values or tasks. Click below to fix.
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="px-3 py-1.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Seeding…' : 'Seed from estimate'}
        </button>
        {error ? (
          <span className="text-[10px] text-error font-semibold">⚠ {error}</span>
        ) : null}
        {success ? (
          <span className="text-[10px] text-success font-semibold">✓ {success}</span>
        ) : null}
      </div>
    </div>
  );
}
