'use client';

/**
 * PhotoFilterBar — the phase toggle + room/area selectors +
 * "+ Add photo" button. Presentational; the parent
 * (ProjectPhotosClient) owns the filter state.
 *
 * Extracted from ProjectPhotosClient.tsx as part of the
 * Aug 2026 photo-component refactor.
 */

import type { PhotoPhase } from '@prisma/client';

export function PhotoFilterBar({
  filterPhase,
  setFilterPhase,
  filterRoom,
  setFilterRoom,
  filterArea,
  setFilterArea,
  facets,
  onAddPhoto,
}: {
  filterPhase: PhotoPhase | 'ALL';
  setFilterPhase: (p: PhotoPhase | 'ALL') => void;
  filterRoom: string;
  setFilterRoom: (r: string) => void;
  filterArea: string;
  setFilterArea: (a: string) => void;
  facets: { rooms: string[]; areas: string[]; roughInCount: number; finalCount: number };
  onAddPhoto: () => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
      <div className="inline-flex border-2 border-ink">
        {(['ALL', 'ROUGH_IN', 'FINAL'] as const).map((phase) => {
          const isActive = filterPhase === phase;
          const label = phase === 'ALL' ? 'All' : phase === 'ROUGH_IN' ? 'Rough-in' : 'Final';
          return (
            <button
              key={phase}
              type="button"
              onClick={() => setFilterPhase(phase)}
              className={`px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-colors ${
                isActive
                  ? 'bg-ink text-cream'
                  : phase === 'ROUGH_IN'
                  ? 'bg-warning/30 text-ink hover:bg-warning/50'
                  : phase === 'FINAL'
                  ? 'bg-success/30 text-ink hover:bg-success/50'
                  : 'bg-paper text-ink-70 hover:bg-cream-2'
              }`}
            >
              {label}
              {phase === 'ROUGH_IN' && ` (${facets.roughInCount})`}
              {phase === 'FINAL' && ` (${facets.finalCount})`}
            </button>
          );
        })}
      </div>

      {facets.rooms.length > 0 ? (
        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="px-3 py-2 bg-paper border-2 border-line text-[12px] font-mono uppercase tracking-[0.05em]"
        >
          <option value="">All rooms</option>
          {facets.rooms.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      ) : null}

      {facets.areas.length > 0 ? (
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="px-3 py-2 bg-paper border-2 border-line text-[12px] font-mono uppercase tracking-[0.05em]"
        >
          <option value="">All areas</option>
          {facets.areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      ) : null}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onAddPhoto}
        className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d"
      >
        + Add photo
      </button>
    </div>
  );
}
