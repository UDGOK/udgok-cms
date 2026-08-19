'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ProjectStatus } from '@prisma/client';
import { STATUS_COLORS, STATUS_LABELS, withAlpha } from '@/lib/map/status-color';
import { regeocodeProjectAction } from '@/lib/projects/actions';

// Map is browser-only. ssr:false is required.
const MapContainer = dynamic(
  () => import('@/components/map/MapContainer').then((m) => m.MapContainer),
  { ssr: false, loading: () => <MapSkeleton /> },
);

export interface ProjectMapTabProps {
  project: {
    id: string;
    name: string;
    code: string | null;
    status: ProjectStatus;
    latitude: number;
    longitude: number;
    city: string | null;
    state: string | null;
    geocodeSource: string | null;
    geocodedAddress: string | null;
  };
  workspaceSlug: string;
  gpsPhotos: Array<{
    id: string;
    url: string;
    filename: string;
    latitude: number;
    longitude: number;
    room: string | null;
    area: string | null;
    takenAt: string | null; // ISO string from server
  }>;
}

/**
 * Project MAP tab. Shows:
 *   - A large pin for the project itself (status-colored)
 *   - Smaller photo markers for every GPS-tagged project photo
 *   - A "Re-geocode" button (re-fires the geocoder on the saved
 *     address; useful when the user updates the address and
 *     forgets to refresh the pin)
 *   - A photo lightbox when a photo marker is clicked
 *
 * Why no Leaflet-style image overlay? The photos are Vercel Blob
 * URLs, and the file count per project rarely exceeds a few
 * hundred. A standard marker pattern keeps the surface area
 * small and works on mobile (no canvas drag jank).
 */
export function ProjectMapTab({
  project,
  workspaceSlug,
  gpsPhotos,
}: ProjectMapTabProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<typeof gpsPhotos[number] | null>(null);
  const [regeoBusy, setRegeoBusy] = useState(false);
  const [regeoMsg, setRegeoMsg] = useState<string | null>(null);

  const initialView = useMemo(
    () => ({
      center: [project.longitude, project.latitude] as [number, number],
      zoom: gpsPhotos.length > 0 ? 16 : 14,
    }),
    [project.longitude, project.latitude, gpsPhotos.length],
  );

  // Compute bounds that include both the project pin and the
  // photo markers. If the photos span more than ~1km, we'd want
  // to call map.fitBounds() — but for now we just center on the
  // project with a reasonable zoom and let users pan to photos.
  // The marker DOM elements are built with `document.createElement`,
  // which only exists in the browser. We build them in a useEffect
  // (client-only) rather than useMemo (which runs during SSR and
  // would throw `ReferenceError: document is not defined`). The
  // markers are still added/removed reactively via the `markers`
  // prop on MapContainer; this just moves the *creation* to the
  // client side.
  const [markers, setMarkers] = useState<Array<{
    id: string;
    coordinates: [number, number];
    element: HTMLElement;
  }>>([]);

  useEffect(() => {
    const result: Array<{
      id: string;
      coordinates: [number, number];
      element: HTMLElement;
    }> = [];
    // 1. Project pin (large, status-colored)
    const projectEl = buildProjectPinEl(project);
    projectEl.addEventListener('click', () => {
      // No-op: the project IS the current view. We just open
      // the location badge by scrolling to it.
      document
        .getElementById('project-location-badge')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    result.push({
      id: `project-${project.id}`,
      coordinates: [project.longitude, project.latitude] as [number, number],
      element: projectEl,
    });
    // 2. Photo markers (smaller, blue)
    for (const photo of gpsPhotos) {
      const el = buildPhotoPinEl(photo);
      el.addEventListener('click', () => setSelectedPhoto(photo));
      result.push({
        id: `photo-${photo.id}`,
        coordinates: [photo.longitude, photo.latitude] as [number, number],
        element: el,
      });
    }
    setMarkers(result);
    // Cleanup: drop marker DOM nodes when the project or
    // photos change so we don't leak elements into the
    // document body. MapContainer also calls marker.remove()
    // on its side, but the elements themselves would persist
    // as detached DOM nodes otherwise.
    return () => {
      for (const m of result) m.element.remove();
    };
  }, [project, gpsPhotos]);

  const markersKey = useMemo(
    () => `proj-${project.id}|${gpsPhotos.map((p) => p.id).join('|')}`,
    [project.id, gpsPhotos],
  );

  const onRegeo = useCallback(async () => {
    setRegeoBusy(true);
    setRegeoMsg(null);
    try {
      const res = await regeocodeProjectAction(workspaceSlug, project.id);
      if (res && res.ok) {
        setRegeoMsg('Coordinates updated.');
        // Refresh the page so the server-rendered badge re-renders
        // with the new coords.
        setTimeout(() => window.location.reload(), 600);
      } else {
        setRegeoMsg(res?.error ?? 'Re-geocode failed');
      }
    } catch (e) {
      setRegeoMsg(e instanceof Error ? e.message : 'Re-geocode failed');
    } finally {
      setRegeoBusy(false);
    }
  }, [project.id]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="text-xs font-mono text-ink-50">
          {gpsPhotos.length === 0
            ? 'No GPS-tagged photos yet.'
            : `${gpsPhotos.length} GPS photo${gpsPhotos.length === 1 ? '' : 's'} pinned`}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/w/${workspaceSlug}/map`}
            className="text-[11px] font-extrabold uppercase tracking-[0.1em] px-3 py-1.5 border border-line bg-paper hover:bg-paper-2"
          >
            ◉ Workspace map
          </a>
          <button
            type="button"
            onClick={onRegeo}
            disabled={regeoBusy}
            className="text-[11px] font-extrabold uppercase tracking-[0.1em] px-3 py-1.5 border border-line bg-paper hover:bg-paper-2 disabled:opacity-50"
          >
            {regeoBusy ? '⟳ Re-geocoding…' : '↻ Re-geocode address'}
          </button>
        </div>
      </div>
      {regeoMsg ? (
        <div className="mb-3 text-xs font-mono text-ink-70">{regeoMsg}</div>
      ) : null}

      <div className="border border-line bg-paper" style={{ height: '60vh', minHeight: 420 }}>
        <MapContainer initialView={initialView} markers={markers} markersKey={markersKey} />
      </div>

      {/* Click an existing photo to see the badge + actions.
          (We don't render a list here — the photos page already does
          that. The map is a spatial index, not a gallery.) */}
      <div id="project-location-badge" className="mt-4">
        <LocationSummary
          lat={project.latitude}
          lng={project.longitude}
          source={project.geocodeSource}
          address={project.geocodedAddress}
        />
      </div>

      {selectedPhoto ? (
        <PhotoLightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      ) : null}
    </div>
  );
}

function buildProjectPinEl(project: ProjectMapTabProps['project']): HTMLButtonElement {
  const color = STATUS_COLORS[project.status];
  const label = STATUS_LABELS[project.status];
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'udgok-map-marker udgok-map-marker--lg';
  btn.setAttribute('aria-label', `Project site: ${project.name}`);
  btn.innerHTML = `
    <span class="udgok-map-marker__halo" style="background:${withAlpha(color, 0.3)}"></span>
    <span class="udgok-map-marker__dot" style="background:${color}"></span>
    <span class="udgok-map-marker__card">
      <span class="udgok-map-marker__name">${escapeHtml(project.name)}</span>
      <span class="udgok-map-marker__meta">
        <span style="color:${color}">●</span> ${escapeHtml(label)} · Project site
      </span>
    </span>
  `;
  return btn;
}

function buildPhotoPinEl(photo: ProjectMapTabProps['gpsPhotos'][number]): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'udgok-map-marker';
  btn.setAttribute('aria-label', `Photo: ${photo.filename}`);
  const location = [photo.room, photo.area].filter(Boolean).join(' · ');
  const when = photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  btn.innerHTML = `
    <span class="udgok-map-marker__halo" style="background:${withAlpha('#2563eb', 0.3)}"></span>
    <span class="udgok-map-marker__dot" style="background:#2563eb"></span>
    <span class="udgok-map-marker__card">
      <span class="udgok-map-marker__name">${escapeHtml(photo.filename)}</span>
      <span class="udgok-map-marker__meta">
        ${escapeHtml(location || 'Untitled photo')}
        ${when ? ` · ${escapeHtml(when)}` : ''}
      </span>
      <span class="udgok-map-marker__value">📷 click to view</span>
    </span>
  `;
  return btn;
}

function LocationSummary({
  lat,
  lng,
  source,
  address,
}: {
  lat: number;
  lng: number;
  source: string | null;
  address: string | null;
}) {
  return (
    <div className="border border-line bg-paper-2 p-3 text-xs font-mono">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-extrabold uppercase tracking-[0.1em] text-ink-50">Site coordinates</span>
        {source ? (
          <span className="text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 bg-paper border border-line">
            {source}
          </span>
        ) : null}
      </div>
      <div>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener"
          className="text-orange-d hover:underline"
        >
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </a>
      </div>
      {address ? (
        <div className="mt-1 text-ink-70">{address}</div>
      ) : null}
    </div>
  );
}

function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: ProjectMapTabProps['gpsPhotos'][number];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-line">
          <div className="text-xs font-extrabold uppercase tracking-[0.1em] truncate">
            {photo.filename}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-50 hover:text-ink text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 bg-paper-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.filename}
            className="max-w-full h-auto mx-auto"
            loading="lazy"
          />
        </div>
        <div className="p-3 border-t border-line text-[11px] font-mono text-ink-50">
          {[photo.room, photo.area].filter(Boolean).join(' · ') || 'No location metadata'}
          {photo.takenAt
            ? ` · ${new Date(photo.takenAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
            : ''}
          {' · '}
          <a
            href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}
            target="_blank"
            rel="noopener"
            className="text-orange-d hover:underline"
          >
            {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
          </a>
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="h-full w-full min-h-[420px] flex items-center justify-center bg-paper-2">
      <div className="text-ink-50 font-mono text-xs uppercase tracking-[0.2em]">
        Loading map…
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
