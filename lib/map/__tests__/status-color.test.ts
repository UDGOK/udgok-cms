import { describe, it, expect } from 'vitest';
import { STATUS_COLORS, STATUS_LABELS, withAlpha } from '../status-color';

describe('STATUS_COLORS', () => {
  it('covers every ProjectStatus enum value', () => {
    // Guards against a future enum addition silently falling
    // through to a default color. Add the new status here too.
    expect(Object.keys(STATUS_COLORS).sort()).toEqual([
      'ACTIVE',
      'CANCELLED',
      'COMPLETED',
      'ON_HOLD',
      'PROSPECT',
    ]);
  });
  it('all colors are valid 6-digit hex strings', () => {
    for (const [status, color] of Object.entries(STATUS_COLORS)) {
      expect(color, `STATUS_COLORS.${status}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
  it('ACTIVE uses the brand orange (#ff5a1f)', () => {
    // The active state must visually dominate a map full of
    // pins, so we hardcode the brand orange here. If the
    // brand color changes, this test fails — that's the point.
    expect(STATUS_COLORS.ACTIVE).toBe('#ff5a1f');
  });
  it('PROSPECT uses indigo to distinguish from active work', () => {
    // A user scanning the map should immediately know PROSPECT
    // pins aren't live jobs. Indigo is the visual "talking
    // stages" signal — distinct from orange (active) and the
    // muted stone/green/grays of the other 3 states.
    expect(STATUS_COLORS.PROSPECT).toBe('#6366f1');
  });
});

describe('STATUS_LABELS', () => {
  it('has a label for every status', () => {
    for (const status of Object.keys(STATUS_COLORS)) {
      expect(STATUS_LABELS[status as keyof typeof STATUS_LABELS]).toBeTruthy();
    }
  });
  it('uses human-friendly labels (not raw enum values)', () => {
    expect(STATUS_LABELS.ON_HOLD).toBe('On hold');
    expect(STATUS_LABELS.CANCELLED).toBe('Cancelled');
    // No underscores leaking into the UI
    for (const label of Object.values(STATUS_LABELS)) {
      expect(label).not.toMatch(/_/);
    }
  });
});

describe('withAlpha', () => {
  it('appends an 8-digit hex alpha to a 6-digit hex color', () => {
    expect(withAlpha('#ff5a1f', 0.5)).toBe('#ff5a1f80');
    expect(withAlpha('#ff5a1f', 0)).toBe('#ff5a1f00');
    expect(withAlpha('#ff5a1f', 1)).toBe('#ff5a1fff');
  });
  it('clamps alpha to [0, 1]', () => {
    expect(withAlpha('#ff5a1f', -1)).toBe('#ff5a1f00');
    expect(withAlpha('#ff5a1f', 2)).toBe('#ff5a1fff');
  });
  it('rounds to the nearest byte', () => {
    // 0.5 * 255 = 127.5 → 128 → 0x80
    expect(withAlpha('#000000', 0.5)).toBe('#00000080');
  });
});
