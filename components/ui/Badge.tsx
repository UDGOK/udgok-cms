import type { ReactNode } from 'react';

type BadgeVariant = 'navy' | 'copper' | 'success' | 'warn' | 'neutral' | 'error';

const variantClasses: Record<BadgeVariant, string> = {
  navy: 'text-ink border-ink',
  copper: 'text-orange-d border-orange bg-orange-bg',
  success: 'text-success border-success bg-[rgba(45,106,79,0.1)]',
  warn: 'text-warn border-warn bg-[rgba(176,137,0,0.1)]',
  error: 'text-error border-error bg-[rgba(157,44,44,0.1)]',
  neutral: 'text-ink-50 border-line',
};

export function Badge({
  children,
  variant = 'navy',
  className = '',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-block font-mono text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-1 border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
