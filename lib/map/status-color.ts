/**
 * Status → marker color mapping. Status is the project's
 * ProjectStatus enum (PROSPECT | ACTIVE | ON_HOLD |
 * COMPLETED | CANCELLED).
 *
 * Colors are tuned to match the Atelier design palette: warm
 * industrial. The active state uses the brand orange (the same
 * `#ff5a1f` family used elsewhere in the app for primary actions).
 * The other states are muted to keep the active projects visually
 * dominant in a map full of pins.
 *
 * PROSPECT (indigo) is intentionally distinct from the other 4 —
 * it's not a live job, it's an opportunity being shaped. A user
 * scanning the map should immediately know which pins are real
 * work in progress vs. which are conversations-in-flight.
 */
import type { ProjectStatus } from '@prisma/client';

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  PROSPECT: '#6366f1',   // indigo-500 — "being shaped"
  ACTIVE: '#ff5a1f',     // brand orange — dominant
  ON_HOLD: '#a8a29e',    // stone-400 — muted
  COMPLETED: '#16a34a',  // green-600 — done
  CANCELLED: '#57534e',  // stone-600 — inactive
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  PROSPECT: 'Prospect',
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
