import type { ReactNode } from 'react';

/**
 * SectionNumber — the UDGOK signature visual device.
 * Renders an orange filled circle with the number, followed by the section label.
 * Example:
 *   <SectionNumber num={1} label="Tokens" />
 */
export function SectionNumber({
  num,
  children,
  className = '',
}: {
  num: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-3.5 font-extrabold tracking-[0.2em] text-ink ${className}`}
    >
      <span className="inline-flex items-center justify-center w-[34px] h-[34px] bg-orange text-white rounded-full font-black text-sm">
        {num}
      </span>
      <span className="text-xs">{children}</span>
    </div>
  );
}
