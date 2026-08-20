'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Inline "filter by vendor" control for the project's
 * INVENTORY tab. Renders as a horizontal pill row of all
 * distinct vendors on the project, with a "Show all" pill
 * to clear the filter.
 *
 * Why a client component? We want the filter to feel
 * instant — picking a vendor navigates to the same page
 * with a different ?vendor=… query string. The server
 * component re-renders the materials list with the filter
 * applied. A full reload is fine because the query is
 * server-rendered, but we wrap in useTransition to keep
 * the page responsive while it re-fetches.
 *
 * Why pills, not a dropdown? Three vendors fits in a row
 * with no scroll; a dropdown is one extra click. The pill
 * also shows the active state at a glance without the user
 * having to open the menu.
 */
export function VendorFilter({
  workspaceSlug,
  projectId,
  vendors,
  current,
  totalShown,
}: {
  workspaceSlug: string;
  projectId: string;
  vendors: string[];
  current: string | null;
  totalShown: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(vendor: string | null) {
    // Build a target URL off the workspace + project path
    // (rather than window.location) so the filter always
    // lands the user on the inventory tab of THIS project,
    // not whatever project tab they happened to be on when
    // they clicked a pill.
    const params = new URLSearchParams();
    params.set('tab', 'inventory');
    if (vendor) params.set('vendor', vendor);
    startTransition(() => {
      router.push(`/w/${workspaceSlug}/projects/${projectId}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
        Filter by vendor
      </span>
      <button
        type="button"
        onClick={() => navigate(null)}
        className={`px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] border-2 ${
          !current
            ? 'bg-ink text-paper border-ink'
            : 'bg-paper text-ink-50 border-line hover:border-ink'
        }`}
      >
        Show all
      </button>
      {vendors.map((v) => {
        const active = current && v.toLowerCase() === current.toLowerCase();
        return (
          <button
            key={v}
            type="button"
            onClick={() => navigate(v)}
            className={`px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] border-2 ${
              active
                ? 'bg-orange text-paper border-orange-d'
                : 'bg-paper text-ink-70 border-line hover:border-orange-d'
            }`}
          >
            {v}
          </button>
        );
      })}
      {current ? (
        <span className="text-[10px] font-mono text-ink-50 ml-1">
          {pending ? '…' : `${totalShown} match${totalShown === 1 ? '' : 'es'}`}
        </span>
      ) : null}
    </div>
  );
}
