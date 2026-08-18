import type { ProjectInsight } from '@/lib/projects/insights';

const LEVEL_STYLE: Record<ProjectInsight['level'], { bg: string; bar: string; text: string; chip: string }> = {
  success: {
    bg: 'bg-success/5 border-success/30',
    bar: 'bg-success',
    text: 'text-success',
    chip: 'bg-success text-paper',
  },
  warning: {
    bg: 'bg-warning/5 border-warning/40',
    bar: 'bg-warning',
    text: 'text-warn',
    chip: 'bg-warning text-ink',
  },
  danger: {
    bg: 'bg-error/5 border-error/40',
    bar: 'bg-error',
    text: 'text-error',
    chip: 'bg-error text-paper',
  },
  info: {
    bg: 'bg-ink/5 border-ink/20',
    bar: 'bg-ink',
    text: 'text-ink',
    chip: 'bg-ink text-cream',
  },
};

const LEVEL_ICON: Record<ProjectInsight['level'], string> = {
  success: '✓',
  warning: '!',
  danger: '⚠',
  info: 'i',
};

const CATEGORY_ICON: Record<ProjectInsight['category'], string> = {
  financial: '$',
  schedule: '◷',
  team: '◉',
  risk: '◈',
  opportunity: '✦',
};

export function AIBoard({ insights }: { insights: ProjectInsight[] }) {
  // Group by level for at-a-glance summary
  const counts = {
    success: insights.filter((i) => i.level === 'success').length,
    warning: insights.filter((i) => i.level === 'warning').length,
    danger: insights.filter((i) => i.level === 'danger').length,
    info: insights.filter((i) => i.level === 'info').length,
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="grid grid-cols-4 border-2 border-ink mb-5 bg-paper">
        <SummaryCell label="On track" count={counts.success} color="bg-success" />
        <SummaryCell label="Watch" count={counts.warning} color="bg-warning" />
        <SummaryCell label="Action needed" count={counts.danger} color="bg-error" />
        <SummaryCell label="FYI" count={counts.info} color="bg-ink" />
      </div>

      <div className="space-y-3">
        {insights.map((ins) => {
          const style = LEVEL_STYLE[ins.level];
          return (
            <div
              key={ins.id}
              className={`${style.bg} border-2 ${style.bg.includes('border-') ? '' : 'border-line'} p-4 md:p-5 flex gap-3 md:gap-4`}
            >
              <div className={`w-1 self-stretch flex-shrink-0 ${style.bar}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span
                    className={`w-6 h-6 flex items-center justify-center font-black text-[13px] ${style.chip} flex-shrink-0`}
                  >
                    {LEVEL_ICON[ins.level]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-extrabold text-[14px] md:text-[15px] tracking-tight ${style.text}`}>
                      {ins.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">
                        {CATEGORY_ICON[ins.category]} {ins.category}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[13px] md:text-[14px] text-ink-70 mt-2 leading-relaxed">
                  {ins.body}
                </p>
                {ins.action ? (
                  <a
                    href={ins.action.href}
                    className="inline-block mt-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:underline"
                  >
                    {ins.action.label} →
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCell({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="p-3 md:p-4 border-r border-line last:border-r-0 flex items-center gap-3">
      <div className={`w-1.5 h-10 ${color}`} />
      <div className="min-w-0">
        <div className="font-black text-xl md:text-2xl leading-none">{count}</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}
