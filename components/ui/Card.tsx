import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Removes default border and shadow, useful inside already-bordered containers. */
  flat?: boolean;
  /** Adds hover lift effect. */
  interactive?: boolean;
}

export function Card({ children, flat, interactive, className = '', ...rest }: CardProps) {
  return (
    <div
      className={[
        'bg-paper',
        flat ? '' : 'border border-line',
        interactive
          ? 'transition-all hover:border-ink hover:-translate-y-0.5 hover:shadow-md cursor-pointer'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex justify-between items-center px-6 py-5 border-b border-line ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h4 className="font-extrabold uppercase tracking-tight text-base">{children}</h4>;
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
