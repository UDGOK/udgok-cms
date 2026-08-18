'use client';

import dynamic from 'next/dynamic';

const PayAppFlow3D = dynamic(
  () => import('./PayAppFlow3D').then((m) => m.PayAppFlow3D),
  {
    ssr: false,
    loading: () => (
      <div className="bg-cream-2 border-2 border-ink flex items-center justify-center" style={{ height: 520 }}>
        <div className="text-center">
          <div className="text-3xl mb-2">💸</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">Loading 3D…</div>
        </div>
      </div>
    ),
  },
);

export interface PayAppFlow3DInput {
  id: string;
  number: number;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACKNOWLEDGED' | 'PAID' | 'OVERDUE';
  amount: number;
  date: Date | null;
  paidAt: Date | null;
}

export function PayAppFlow3DViewer(props: {
  contractTotal: number;
  payApps: PayAppFlow3DInput[];
  height?: number;
}) {
  return <PayAppFlow3D {...props} />;
}
