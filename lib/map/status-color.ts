/**
 * Status → marker color mapping. Status is the project's
 * ProjectStatus enum (ACTIVE | ON_HOLD | COMPLETED | CANCELLED).
 *
 * Colors are tuned to match the Atelier design palette: warm
 * industrial. The active state uses the brand orange (the same
 * `#ff5a1f` family used elsewhere in the app for primary actions).
 * The other states are muted to keep the active projects visually
 * dominant in a map full of pins.
 */
import type { ProjectStatus } from '@prisma/client';

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  ACTIVE: '#ff5a1f',     // brand orange — dominant
  ON_HOLD: '#a8a29e',    // stone-400 — muted
  COMPLETED: '#16a34a',  // green-600 — done
  CANCELLED: '#57534e',  // stone-600 — inactive
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** Hex with alpha for the marker halo. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
