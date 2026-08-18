'use client';

import { useEffect, useState } from 'react';
import type { ProjectInsight } from '@/lib/projects/insights';
import type { DeepInsight, DeepAnalysis } from '@/lib/ai/project-analyzer';

const LEVEL_STYLE = {
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
} as const;

const LEVEL_ICON = {
  success: '✓',
  warning: '!',
  danger: '⚠',
  info: 'i',
} as const;

const CATEGORY_ICON: Record<DeepInsight['category'], string> = {
  financial: '$',
  schedule: '◷',
  team: '◉',
  risk: '◈',
  opportunity: '✦',
  communication: '✉',
};

interface AIBoardProps {
  ruleInsights: ProjectInsight[];
  /** Initial deep analysis from server (may be null when fetched client-side). */
  initialDeepInsights?: DeepInsight[];
  initialDeepAnalysis?: DeepAnalysis | null;
  /** Project ID — used to fetch the deep analysis on the client. */
  projectId: string;
}

export function AIBoard({
  ruleInsights,
  initialDeepInsights = [],
  initialDeepAnalysis = null,
  projectId,
}: AIBoardProps) {
  // Deep analysis is now fetched client-side so the page renders
  // immediately with rule-based insights. The AI call can take
  // 5-30s depending on model load — show a skeleton while it loads.
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(initialDeepAnalysis);
  const [deepInsights, setDeepInsights] = useState<DeepInsight[]>(initialDeepInsights);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    // Skip if we already have data from the server (no client fetch needed)
    if (initialDeepAnalysis) return;
    let cancelled = false;
    setAiLoading(true);
    setAiError(null);
    fetch('/api/ai/project-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ deepAnalysis: DeepAnalysis | null; deepInsights: DeepInsight[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.deepAnalysis) setDeepAnalysis(data.deepAnalysis);
        if (data.deepInsights) setDeepInsights(data.deepInsights);
        setAiLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setAiError(err instanceof Error ? err.message : 'AI analysis failed');
        setAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, initialDeepAnalysis]);

  // Merge insights for the at-a-glance summary
  const all = [
    ...ruleInsights.map((i) => ({ ...i, source: 'rule' as const })),
    ...deepInsights.map((i) => ({ ...i, source: 'nvidia' as const })),
  ];
  const counts = {
    success: all.filter((i) => i.level === 'success').length,
    warning: all.filter((i) => i.level === 'warning').length,
    danger: all.filter((i) => i.level === 'danger').length,
    info: all.filter((i) => i.level === 'info').length,
  };

  const [showDeep, setShowDeep] = useState(true);

  return (
    <div>
      {/* Loading skeleton while the deep AI analysis streams in */}
      {aiLoading && !deepAnalysis ? (
        <div className="mb-5 bg-paper border-2 border-ink p-5 md:p-7">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-orange text-paper flex items-center justify-center font-black text-lg flex-shrink-0 animate-pulse">
                ✦
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d font-extrabold">
                  {'// NVIDIA executive summary'}
                </div>
                <div className="space-y-2 mt-2">
                  <div className="h-3 bg-cream-2 w-full animate-pulse" />
                  <div className="h-3 bg-cream-2 w-5/6 animate-pulse" />
                  <div className="h-3 bg-cream-2 w-4/6 animate-pulse" />
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-30 mt-3">
                  AI is reading the project — usually 5–15 seconds…
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="font-black text-4xl leading-none text-ink-30 animate-pulse">
                —
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-30 mt-1">
                HEALTH SCORE
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error state */}
      {aiError && !deepAnalysis ? (
        <div className="mb-5 bg-error/5 border-2 border-error/40 p-4 flex items-start gap-3">
          <div className="text-2xl">⚠</div>
          <div>
            <div className="font-extrabold text-error text-sm uppercase tracking-[0.05em]">
              AI analysis failed
            </div>
            <div className="text-[12px] text-ink-70 mt-1">
              {aiError}. The rule-based insights below are still accurate.
            </div>
            <button
              type="button"
              onClick={() => {
                setAiError(null);
                setAiLoading(true);
                // re-trigger by toggling initialDeepAnalysis briefly
                setDeepAnalysis(null);
                // simple retry: re-fire the effect by changing projectId locally
                // (use a state-based approach: just re-call fetch)
                fetch('/api/ai/project-analysis', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ projectId }),
                })
                  .then((r) => r.json())
                  .then((d: { deepAnalysis: DeepAnalysis | null; deepInsights: DeepInsight[] }) => {
                    if (d.deepAnalysis) setDeepAnalysis(d.deepAnalysis);
                    if (d.deepInsights) setDeepInsights(d.deepInsights);
                  })
                  .catch((e) => setAiError(e instanceof Error ? e.message : 'AI failed'))
                  .finally(() => setAiLoading(false));
              }}
              className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-error hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {/* DeepSeek executive summary (only if available) */}
      {deepAnalysis ? (
        <div className="mb-5 bg-paper border-2 border-ink p-5 md:p-7">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-orange text-paper flex items-center justify-center font-black text-lg flex-shrink-0">
                ✦
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d font-extrabold">
                  {'// NVIDIA executive summary'}
                </div>
                <p className="text-[15px] md:text-[16px] text-ink mt-1 leading-relaxed font-medium">
                  {deepAnalysis.summary}
                </p>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-30 mt-2">
                  Generated by {deepAnalysis.model} · {new Date(deepAnalysis.generatedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <div className={`font-black text-4xl leading-none ${
                deepAnalysis.healthScore >= 80
                  ? 'text-success'
                  : deepAnalysis.healthScore >= 50
                    ? 'text-orange-d'
                    : 'text-error'
              }`}>
                {deepAnalysis.healthScore}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1">
                / 100 health
              </div>
            </div>
          </div>

          {/* Risks + Opportunities + Next actions */}
          {(deepAnalysis.risks.length > 0 || deepAnalysis.opportunities.length > 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-line">
              {deepAnalysis.risks.length > 0 ? (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-error font-extrabold mb-2 flex items-center gap-1.5">
                    <span>⚠</span> Key risks
                  </div>
                  <ul className="space-y-1.5">
                    {deepAnalysis.risks.map((r, i) => (
                      <li key={i} className="text-[13px] text-ink-70 flex gap-2">
                        <span className="text-error flex-shrink-0">→</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {deepAnalysis.opportunities.length > 0 ? (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-success font-extrabold mb-2 flex items-center gap-1.5">
                    <span>✦</span> Opportunities
                  </div>
                  <ul className="space-y-1.5">
                    {deepAnalysis.opportunities.map((o, i) => (
                      <li key={i} className="text-[13px] text-ink-70 flex gap-2">
                        <span className="text-success flex-shrink-0">→</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {deepAnalysis.nextActions.length > 0 ? (
            <div className="mt-5 pt-5 border-t border-line">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange-d font-extrabold mb-3 flex items-center gap-1.5">
                <span>→</span> Next actions (in priority order)
              </div>
              <ol className="space-y-2.5">
                {deepAnalysis.nextActions.map((a, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 bg-ink text-cream flex items-center justify-center font-black text-[12px] flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={a.href}
                        className="font-extrabold text-[14px] text-ink hover:text-orange-d"
                      >
                        {a.title} →
                      </a>
                      <p className="text-[12px] text-ink-70 mt-0.5">{a.why}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Summary bar */}
      <div className="grid grid-cols-4 border-2 border-ink mb-5 bg-paper">
        <SummaryCell label="On track" count={counts.success} color="bg-success" />
        <SummaryCell label="Watch" count={counts.warning} color="bg-warning" />
        <SummaryCell label="Action needed" count={counts.danger} color="bg-error" />
        <SummaryCell label="FYI" count={counts.info} color="bg-ink" />
      </div>

      {/* DeepSeek-only toggle */}
      {deepInsights.length > 0 ? (
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDeep(!showDeep)}
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange-d hover:underline"
          >
            {showDeep ? '− Hide' : '+ Show'} DeepSeek-only insights ({deepInsights.length})
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {ruleInsights.map((ins) => {
          const style = LEVEL_STYLE[ins.level];
          return (
            <InsightRow
              key={ins.id}
              ins={ins}
              style={style}
              source="rule"
            />
          );
        })}
        {showDeep && deepInsights.map((ins, i) => {
          const style = LEVEL_STYLE[ins.level];
          return (
            <InsightRow
              key={`deep-${i}-${ins.title}`}
              ins={{
                id: `deep-${i}`,
                level: ins.level,
                category: ins.category,
                title: ins.title,
                body: ins.body,
                action: ins.action,
              }}
              style={style}
              source="deepseek"
            />
          );
        })}
      </div>
    </div>
  );
}

function InsightRow({
  ins,
  style,
  source,
}: {
  ins: { id: string; level: keyof typeof LEVEL_STYLE; category: string; title: string; body: string; action?: { label: string; href: string } };
  style: typeof LEVEL_STYLE[keyof typeof LEVEL_STYLE];
  source: 'rule' | 'deepseek';
}) {
  return (
    <div className={`${style.bg} border-2 p-4 md:p-5 flex gap-3 md:gap-4`}>
      <div className={`w-1 self-stretch flex-shrink-0 ${style.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`w-6 h-6 flex items-center justify-center font-black text-[13px] ${style.chip} flex-shrink-0`}>
            {LEVEL_ICON[ins.level]}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className={`font-extrabold text-[14px] md:text-[15px] tracking-tight ${style.text}`}>
              {ins.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">
                {CATEGORY_ICON[ins.category as keyof typeof CATEGORY_ICON] ?? '◉'} {ins.category}
              </span>
              {source === 'deepseek' ? (
                <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-orange-d">
                  · DeepSeek
                </span>
              ) : null}
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
