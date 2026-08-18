/**
 * MapLibre style for the workspace + project maps. Uses raw
 * OpenStreetMap raster tiles — no API key required. Per the OSM
 * Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/):
 *
 *   - Use is limited to "light, non-commercial use" — UDGOK is
 *     an internal CMS, so this is fine.
 *   - We MUST set a meaningful `User-Agent` (set by the browser,
 *     not under our control here, but OSM in practice blocks
 *     default-bot UAs rather than browser UAs).
 *   - Bulk downloads and "heavy use" are prohibited. For
 *     heavy-traffic production, swap the source for MapTiler
 *     (https://maptiler.com) or Stadia Maps and pass the API
 *     key via env. UDGOK's internal traffic is light enough
 *     that raw OSM works.
 *
 * The style is intentionally minimal — one raster source, one
 * layer. Vector styles (label density, contour lines, etc.)
 * would require a paid provider; for an internal map of "where
 * are our projects" we just need the road network and labels.
 */
import type { StyleSpecification } from 'maplibre-gl';

export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: undefined,
};
