import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'copper' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-[0.12em] border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-cream border-ink hover:bg-orange hover:border-orange',
  secondary: 'bg-transparent text-ink border-ink hover:bg-ink hover:text-cream',
  copper: 'bg-orange text-paper border-orange hover:bg-orange-dark hover:border-orange-dark',
  ghost: 'bg-transparent text-ink border-line hover:border-ink',
  danger: 'bg-error text-paper border-error hover:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-[10px] px-3 py-2',
  md: 'text-xs px-4 py-3',
  lg: 'text-sm px-5 py-4',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leading,
    trailing,
    fullWidth,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
});
