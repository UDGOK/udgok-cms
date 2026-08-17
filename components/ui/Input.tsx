import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';

const baseInputClasses =
  'block w-full px-3.5 py-3 bg-transparent border border-line text-ink font-sans text-sm outline-none transition-colors placeholder:text-ink-30 focus:border-ink disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`${baseInputClasses} ${className}`} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`${baseInputClasses} resize-y ${className}`} {...rest} />;
});

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block mb-1.5 font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-ink-50"
    >
      {children}
      {hint ? <span className="ml-1 text-ink-30">{hint}</span> : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error ? <p className="mt-1 text-xs text-error font-semibold">{error}</p> : null}
    </div>
  );
}
