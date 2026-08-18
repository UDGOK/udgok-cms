'use client';

import dynamic from 'next/dynamic';

// Load the 3D component client-side only (Three.js needs window/WebGL)
const ThreeDGantt = dynamic(
  () => import('./ThreeDGantt').then((m) => m.ThreeDGantt),
  {
    ssr: false,
    loading: () => (
      <div className="bg-cream-2 border-2 border-ink flex items-center justify-center" style={{ height: 480 }}>
        <div className="text-center">
          <div className="text-3xl mb-2">🧊</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">Loading 3D…</div>
        </div>
      </div>
    ),
  },
);

export interface GanttTask3DInput {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  startDate: Date | null;
  endDate: Date | null;
  dueDate: Date | null;
}

export function ThreeDGanttViewer(props: {
  projectName: string;
  projectStart: Date | null;
  projectEnd: Date | null;
  tasks: GanttTask3DInput[];
  height?: number;
}) {
  return <ThreeDGantt {...props} />;
}
