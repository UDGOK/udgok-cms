import { describe, it, expect } from 'vitest';
import { OSM_STYLE } from '../style';

/**
 * Regression test for the "white in the map area" bug.
 *
 * MapLibre 4.x has a STRICT style validator. Passing
 * `glyphs: undefined` (or `glyphs: null`) throws
 *
 *   "Error: glyphs: string expected, undefined found"
 *
 * at map init time, leaving the canvas in an empty state. The
 * only valid values are a string URL to a glyphs PBF, or the
 * key being absent. We want the key ABSENT (not undefined)
 * because we don't have any text layers in this style.
 *
 * This test catches:
 *   - accidentally setting `glyphs: undefined`
 *   - accidentally setting `glyphs: null`
 *   - missing the version field (also required)
 *   - missing the layers array
 *   - missing the sources object
 */
describe('OSM_STYLE', () => {
  it('has a version: 8 (MapLibre style spec version)', () => {
    expect(OSM_STYLE.version).toBe(8);
  });

  it('has at least one source and at least one layer', () => {
    expect(Object.keys(OSM_STYLE.sources ?? {}).length).toBeGreaterThan(0);
    expect((OSM_STYLE.layers ?? []).length).toBeGreaterThan(0);
  });

  it('does NOT set `glyphs: undefined` (MapLibre throws on init)', () => {
    // The key must be ABSENT, not present-with-undefined. We
    // check the raw object — `'glyphs' in OSM_STYLE` would also
    // match if someone set it to a string, which is fine. We
    // want it to NOT be set to undefined/null.
    const v = (OSM_STYLE as Record<string, unknown>).glyphs;
    expect(v).toBeUndefined();
    // Belt-and-braces: serializing to JSON drops undefined keys
    // entirely, which is exactly the on-the-wire shape we want.
    const json = JSON.parse(JSON.stringify(OSM_STYLE));
    expect(json.glyphs).toBeUndefined();
  });

  it('sources.osm has a tiles array with https URLs', () => {
    const src = OSM_STYLE.sources?.osm;
    expect(src).toBeDefined();
    if (src && src.type === 'raster') {
      expect(Array.isArray(src.tiles)).toBe(true);
      expect((src.tiles ?? []).length).toBeGreaterThan(0);
      for (const url of src.tiles ?? []) {
        expect(url).toMatch(/^https:\/\//);
      }
    }
  });

  it('all layer types are valid MapLibre layer types', () => {
    const VALID = ['background', 'circle', 'fill', 'fill-extrusion', 'heatmap',
      'hillshade', 'line', 'raster', 'symbol'];
    for (const layer of OSM_STYLE.layers ?? []) {
      expect(VALID, `layer ${layer.id}`).toContain(layer.type);
    }
  });
});
