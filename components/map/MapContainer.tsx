'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MaplibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OSM_STYLE } from '@/lib/map/style';

export interface MapMarkerSpec {
  /** Stable React key. */
  id: string;
  /** [lng, lat] — GeoJSON order, not [lat, lng]. */
  coordinates: [number, number];
  /** HTML rendered into the marker. Caller controls content. */
  element: HTMLElement;
  /** Optional popup attached to the marker. */
  popup?: maplibregl.Popup;
}

export interface MapContainerProps {
  /** [lng, lat, zoom]. Falls back to a continental US view. */
  initialView?: { center: [number, number]; zoom: number };
  markers?: MapMarkerSpec[];
  /** Re-render markers when this changes (e.g. when projects reload). */
  markersKey?: string;
  /** Inline style for the map div. Defaults to 100% width/height. */
  style?: React.CSSProperties;
  /** Optional className for the map div. */
  className?: string;
  /**
   * If set, this callback receives the live Map instance after
   * `load` so callers can add layers / sources imperatively.
   */
  onMapReady?: (map: MaplibreMap) => void;
}

/**
 * Thin MapLibre wrapper. Renders a div, instantiates the map,
 * and manages marker lifecycle (add/remove on prop change).
 *
 * Why not react-map-gl? It adds another dependency on top of
 * maplibre-gl and wraps marker logic in a way that's hard to
 * debug when something goes wrong with custom HTML markers.
 * For UDGOK's two map use-cases (workspace overview + project
 * MAP tab), a direct maplibre-gl binding keeps the surface
 * small and matches the same pattern we use for Three.js
 * (next/dynamic + ssr:false, no React wrapper).
 */
export function MapContainer({
  initialView = { center: [-98.5795, 39.8283], zoom: 3.6 }, // continental US
  markers = [],
  markersKey,
  style,
  className,
  onMapReady,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  // Track previous markersKey so we know when to re-add markers.
  const lastMarkersKeyRef = useRef<string | undefined>(markersKey);

  // 1. Init the map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      // The style spec is a known good value — we use the
      // OSM_STYLE constant. Mutating it from a style URL
      // (e.g. demotiles.maplibre.org) would require CORS
      // headers; raw tiles don't.
      style: OSM_STYLE,
      center: initialView.center,
      zoom: initialView.zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      onMapReady?.(map);
    });
    mapRef.current = map;
    return () => {
      // Cleanup: remove markers + map. Without removing
      // markers, the HTML elements stay in the DOM detached
      // from the React tree (memory leak).
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // We intentionally only run this effect once. initialView
    // changes after mount are ignored (callers should use
    // map.flyTo() directly via onMapReady).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Sync markers when the array or key changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lastMarkersKeyRef.current === markersKey) return;
    // Remove old markers before adding new ones.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    for (const spec of markers) {
      const m = new maplibregl.Marker({ element: spec.element })
        .setLngLat(spec.coordinates);
      if (spec.popup) m.setPopup(spec.popup);
      m.addTo(map);
      markersRef.current.push(m);
    }
    lastMarkersKeyRef.current = markersKey;
  }, [markers, markersKey]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', minHeight: 400, ...style }}
    />
  );
}
