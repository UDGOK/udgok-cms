'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectStatus } from '@prisma/client';
import { MapContainer, type MapMarkerSpec } from '@/components/map/MapContainer';
import { STATUS_COLORS, STATUS_LABELS, withAlpha } from '@/lib/map/status-color';

export interface MapProject {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  contractValue: string | null; // Decimal serialized to string
}

/**
 * Workspace-wide project map. Renders one pin per project with
 * status-colored halo, name popup on click, and click-to-navigate
 * to the project page.
 *
 * Why custom HTML markers (not circle layers)?
 *  - Hover affordances (status badge, contract value) are easier
 *    to style as DOM than as MapLibre paint expressions.
 *  - Click target is the whole pin element, not a 6px circle that
 *    requires picking tolerance.
 *  - We don't need to render thousands of pins (a workspace rarely
 *    has more than ~50 active projects), so DOM overhead is fine.
 */
export function WorkspaceMapClient({
  projects,
  workspaceSlug,
}: {
  projects: MapProject[];
  workspaceSlug: string;
}) {
  const router = useRouter();

  // Compute a fit-bounds center: the average of all pins. If we
  // used the first project, a single project in Tulsa would zoom
  // to street level. Average is wrong for outliers but fine for
  // the typical case (a contractor's projects cluster around a
  // region). For a more robust fit, callers can extend this to
  // compute the actual bounding box and call map.fitBounds().
  const initialView = useMemo(() => {
    if (projects.length === 0) {
      return { center: [-98.5795, 39.8283] as [number, number], zoom: 3.6 };
    }
    if (projects.length === 1) {
      return { center: [projects[0].longitude, projects[0].latitude] as [number, number], zoom: 11 };
    }
    const sumLng = projects.reduce((a, p) => a + p.longitude, 0);
    const sumLat = projects.reduce((a, p) => a + p.latitude, 0);
    return {
      center: [sumLng / projects.length, sumLat / projects.length] as [number, number],
      zoom: 6,
    };
  }, [projects]);

  const goToProject = useCallback(
    (id: string) => router.push(`/w/${workspaceSlug}/projects/${id}`),
    [router, workspaceSlug],
  );

  // markersKey changes when the project list changes; that triggers
  // the MapContainer to drop old markers and render the new ones.
  const markersKey = useMemo(
    () => projects.map((p) => p.id).sort().join('|'),
    [projects],
  );

  // Markers are built with `document.createElement` so we have to
  // construct them in a useEffect (client-only) rather than
  // useMemo (which runs during SSR and would throw
  // `ReferenceError: document is not defined`). The map still
  // gets the markers reactively via the prop below.
  const [markers, setMarkers] = useState<MapMarkerSpec[]>([]);

  useEffect(() => {
    const built: MapMarkerSpec[] = projects.map((p) => {
      const el = buildMarkerEl(p);
      el.addEventListener('click', () => goToProject(p.id));
      return {
        id: p.id,
        coordinates: [p.longitude, p.latitude],
        element: el,
      };
    });
    setMarkers(built);
    return () => {
      for (const m of built) m.element.remove();
    };
  }, [projects, goToProject]);

  return (
    <MapContainer
      initialView={initialView}
      markers={markers}
      markersKey={markersKey}
    />
  );
}

function buildMarkerEl(p: MapProject): HTMLButtonElement {
  const color = STATUS_COLORS[p.status];
  const label = STATUS_LABELS[p.status];
  const location = [p.city, p.state].filter(Boolean).join(', ');
  const value = p.contractValue
    ? `$${Number(p.contractValue).toLocaleString()}`
    : 'No value';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', `Open project ${p.name}`);
  btn.className = 'udgok-map-marker';
  btn.innerHTML = `
    <span class="udgok-map-marker__halo" style="background:${withAlpha(color, 0.25)}"></span>
    <span class="udgok-map-marker__dot" style="background:${color}"></span>
    <span class="udgok-map-marker__card">
      <span class="udgok-map-marker__name">${escapeHtml(p.name)}</span>
      <span class="udgok-map-marker__meta">
        <span class="udgok-map-marker__status" style="color:${color}">●</span>
        ${escapeHtml(label)}
        ${location ? ` · ${escapeHtml(location)}` : ''}
      </span>
      <span class="udgok-map-marker__value">${escapeHtml(value)}</span>
    </span>
  `;
  return btn;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
