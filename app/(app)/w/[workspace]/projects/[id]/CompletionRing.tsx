'use client';

interface CompletionRingProps {
  value: number; // 0-100
  size?: number;
  label?: string;
  sublabel?: string;
  strokeWidth?: number;
}

export function CompletionRing({
  value,
  size = 80,
  label,
  sublabel,
  strokeWidth = 8,
}: CompletionRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.max(0, Math.min(100, value));
  const dash = (safeValue / 100) * circumference;
  const gap = circumference - dash;

  // Color based on progress
  const color =
    safeValue >= 80
      ? 'var(--success)'
      : safeValue >= 40
        ? 'var(--orange)'
        : 'var(--error)';

  return (
    <div className="inline-flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${gap}`}
            style={{ transition: 'stroke-dasharray 600ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-black text-[20px] leading-none" style={{ color }}>
            {Math.round(safeValue)}%
          </div>
          {label ? (
            <div className="text-[8px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1">
              {label}
            </div>
          ) : null}
        </div>
      </div>
      {sublabel ? (
        <div className="text-[10px] text-ink-50 mt-1.5 text-center">{sublabel}</div>
      ) : null}
    </div>
  );
}
