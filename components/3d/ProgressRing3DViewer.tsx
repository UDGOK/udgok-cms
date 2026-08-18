'use client';

import dynamic from 'next/dynamic';

const ProgressRing3D = dynamic(
  () => import('./ProgressRing3D').then((m) => m.ProgressRing3D),
  {
    ssr: false,
    loading: () => (
      <div className="bg-cream-2 border-2 border-ink flex items-center justify-center" style={{ height: 380 }}>
        <div className="text-center">
          <div className="text-3xl mb-2">⭕</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">Loading 3D…</div>
        </div>
      </div>
    ),
  },
);

export function ProgressRing3DViewer(props: {
  percent: number;
  financial: number;
  tasks: number;
  subs: number;
  schedule: number;
  status: string;
  height?: number;
  title?: string;
}) {
  return <ProgressRing3D {...props} />;
}
