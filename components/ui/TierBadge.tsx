import { Plan } from '@prisma/client';
import { PLAN_INFO } from '@/lib/workspace/tier';

export function TierBadge({ plan, size = 'sm' }: { plan: Plan; size?: 'sm' | 'md' }) {
  const info = PLAN_INFO[plan];
  return (
    <span
      className={`inline-flex items-center font-extrabold uppercase tracking-[0.12em] ${
        size === 'md' ? 'px-3 py-1 text-[10px]' : 'px-2 py-0.5 text-[9px]'
      } ${info.color}`}
    >
      {info.label}
    </span>
  );
}
