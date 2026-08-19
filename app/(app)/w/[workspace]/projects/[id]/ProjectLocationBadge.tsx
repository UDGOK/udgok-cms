'use client';

import { useState, useTransition } from 'react';
import { regeocodeProjectAction, clearManualPinAction } from '@/lib/projects/actions';
import { RelativeTime } from '@/components/ui/RelativeTime';

interface ProjectLocationBadgeProps {
  workspaceSlug: string;
  projectId: string;
  latitude: number;
  longitude: number;
  geocodeSource: string | null;
  geocodedAt: Date | null;
  geocodedAddress: string | null;
}

/**
 * Small inline block under the project address showing the geocoded
 * coordinates, the source, and a couple of action buttons.
 *
 * Renders a link to Google Maps so the user can confirm the pin
 * visually without leaving the page. Re-geocode runs the same flow
 * the auto-geocode does, but on demand. "Clear pin" wipes a manual
 * pin so the next address edit will re-auto-geocode.
 */
export function ProjectLocationBadge({
  workspaceSlug,
  projectId,
  latitude,
  longitude,
  geocodeSource,
  geocodedAt,
  geocodedAddress,
}: ProjectLocationBadgeProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=18`;
  const isManual = geocodeSource === 'manual';
  const isCached = geocodeSource === 'cached';

  function onRegeocode() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await regeocodeProjectAction(workspaceSlug, projectId);
      if (res?.error) setError(res.error);
      else if (res?.ok) setSuccess(`Updated to ${res.latitude?.toFixed(4)}, ${res.longitude?.toFixed(4)}`);
    });
  }

  function onClearPin() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await clearManualPinAction(workspaceSlug, projectId);
      if (res?.error) setError(res.error);
      else setSuccess('Pin cleared. Next address edit will auto-geocode.');
    });
  }

  return (
    <div className="mt-2 text-[11px] font-mono flex flex-wrap items-center gap-2">
      <span
        className={
          'inline-flex items-center gap-1 px-2 py-0.5 border ' +
          (isManual
            ? 'border-orange bg-orange/10 text-orange-d'
            : isCached
            ? 'border-ink-30 bg-cream-2 text-ink-70'
            : 'border-success bg-success/10 text-success')
        }
        title={geocodedAddress ?? undefined}
      >
        {isManual ? '📌' : isCached ? '⚡' : '🌍'}{' '}
        {isManual ? 'PINNED' : isCached ? 'CACHED' : 'GEOCODED'}
      </span>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-orange-d hover:underline"
      >
        {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </a>
      <span className="text-ink-30">·</span>
      <a href={osmUrl} target="_blank" rel="noopener noreferrer" className="text-ink-50 hover:underline">
        OSM
      </a>
      {geocodedAt ? (
        <>
          <span className="text-ink-30">·</span>
          <span className="text-ink-30"><RelativeTime iso={geocodedAt.toISOString()} /></span>
        </>
      ) : null}
      {!isManual ? (
        <button
          type="button"
          onClick={onRegeocode}
          disabled={isPending}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline disabled:opacity-50"
        >
          {isPending ? '…' : '↻ Re-geocode'}
        </button>
      ) : null}
      {isManual ? (
        <button
          type="button"
          onClick={onClearPin}
          disabled={isPending}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-50 hover:text-error hover:underline disabled:opacity-50"
        >
          {isPending ? '…' : '✕ Clear pin'}
        </button>
      ) : null}
      {error ? <span className="text-error">⚠ {error}</span> : null}
      {success ? <span className="text-success">{success}</span> : null}
    </div>
  );
}
