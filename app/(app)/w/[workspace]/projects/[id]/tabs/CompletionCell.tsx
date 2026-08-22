/**
 * CompletionCell — one cell in the project overview's
 * 4-cell completion breakdown (Financial / Tasks / Schedule /
 * Subs). Small visual gauge with a progress bar that turns
 * warning / danger when the percent is low.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor.
 */

export function CompletionCell({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: number;
  sub: string;
  warn?: boolean;
}) {
  const color = value >= 80 ? 'bg-success' : value >= 40 ? 'bg-orange' : 'bg-error';
  return (
    <div className="bg-paper border-2 border-line p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className={`font-black text-2xl ${warn ? 'text-error' : ''}`}>{value}%</div>
        {warn ? (
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-error">off track</span>
        ) : null}
      </div>
      <div className="h-1 bg-cream-2 mt-2 mb-1.5">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
        {sub}
      </div>
    </div>
  );
}
