'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { GlobalHealth, ProjectHealthRow } from '@/lib/ai/project-health';

const STATUS_COLOR = {
  ACTIVE: 'bg-success text-paper',
  ON_HOLD: 'bg-warning text-ink',
  COMPLETED: 'bg-ink text-cream',
  CANCELLED: 'bg-ink-30 text-ink',
} as const;

const HEALTH_COLOR = (score: number) =>
  score >= 80 ? 'text-success' : score >= 50 ? 'text-orange-d' : 'text-error';

export function GlobalHealthDashboard({ health }: { health: GlobalHealth }) {
  return (
    <div>
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Active projects" value={health.total} sub={`${health.byStatus.ON_HOLD ?? 0} on hold`} />
        <SummaryCard
          label="Avg completion"
          value={`${health.avgCompletion}%`}
          sub={`${health.avgFinancial}% billed`}
          color={health.avgCompletion >= 60 ? 'success' : health.avgCompletion >= 30 ? 'warning' : 'danger'}
        />
        <SummaryCard
          label="At risk"
          value={health.atRiskCount}
          sub={`${health.onTrackCount} on track`}
          color={health.atRiskCount > 0 ? 'warning' : 'success'}
        />
        <SummaryCard
          label="AI"
          value={health.aiEnabled ? 'ON' : 'OFF'}
          sub={`${health.rows.filter((r) => r.hasDeepAnalysis).length} analyzed`}
          color={health.aiEnabled ? 'success' : 'ink'}
        />
      </div>

      {/* Sort + filter */}
      <ProjectTable rows={health.rows} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color = 'ink',
}: {
  label: string;
  value: string | number;
  sub: string;
  color?: 'success' | 'warning' | 'danger' | 'ink';
}) {
  const colorClass = {
    success: 'text-success',
    warning: 'text-warn',
    danger: 'text-error',
    ink: 'text-ink',
  }[color];
  return (
    <div className="bg-paper border-2 border-ink p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">{label}</div>
      <div className={`font-black text-3xl mt-1 ${colorClass}`}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1">{sub}</div>
    </div>
  );
}

function ProjectTable({ rows }: { rows: ProjectHealthRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
        No active projects.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <ProjectRow key={r.id} row={r} />
      ))}
    </div>
  );
}

function ProjectRow({ row }: { row: ProjectHealthRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-paper border-2 border-ink overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-cream-2"
      >
        {/* Risk badge */}
        <div className="w-12 flex-shrink-0 text-center">
          {row.riskCount > 0 ? (
            <div className="w-9 h-9 bg-error text-paper flex items-center justify-center font-black text-sm">
              {row.riskCount}
            </div>
          ) : row.warningCount > 0 ? (
            <div className="w-9 h-9 bg-warning text-ink flex items-center justify-center font-black text-sm">
              {row.warningCount}
            </div>
          ) : (
            <div className="w-9 h-9 bg-success text-paper flex items-center justify-center font-black text-sm">
              ✓
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-extrabold text-[14px] truncate">{row.name}</span>
            <span className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] ${STATUS_COLOR[row.status as keyof typeof STATUS_COLOR] ?? 'bg-ink-30 text-ink'}`}>
              {row.status}
            </span>
            {row.deepHealthScore !== null ? (
              <span
                className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] border ${HEALTH_COLOR(row.deepHealthScore)} border-current`}
                title="DeepSeek health score"
              >
                ✦ {row.deepHealthScore}
              </span>
            ) : null}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-0.5">
            {row.workspaceName}
            {row.clientName ? ` · ${row.clientName}` : ''}
            {row.daysRemaining !== null ? ` · ${row.daysRemaining}d left` : ''}
          </div>
          {row.topInsight ? (
            <div className="text-[12px] text-ink-70 mt-1 line-clamp-1">
              <span className="text-orange-d">→</span> {row.topInsight.title}
            </div>
          ) : null}
        </div>

        {/* Progress */}
        <div className="w-32 flex-shrink-0 hidden md:block">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            <span>Overall</span>
            <span className="font-black text-ink">{row.completion}%</span>
          </div>
          <div className="h-1.5 bg-cream-2">
            <div
              className={`h-full ${
                row.completion >= 80 ? 'bg-success' : row.completion >= 40 ? 'bg-orange' : 'bg-error'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, row.completion))}%` }}
            />
          </div>
        </div>

        <div className="text-ink-50 flex-shrink-0 w-6 text-right">{expanded ? '−' : '+'}</div>
      </button>

      {expanded ? (
        <div className="border-t-2 border-ink p-4 bg-cream-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="Financial" value={`${row.financial}%`} color={row.financial >= 60 ? 'success' : row.financial >= 30 ? 'warning' : 'danger'} />
            <Metric label="Tasks" value={`${row.tasks}%`} color={row.tasks >= 60 ? 'success' : row.tasks >= 30 ? 'warning' : 'danger'} />
            <Metric label="Schedule" value={`${row.schedule}%`} color={row.schedule >= 60 ? 'success' : row.schedule >= 30 ? 'warning' : 'danger'} />
            <Metric label="Contract" value={row.contractValue > 0 ? `$${row.contractValue.toLocaleString()}` : '—'} />
          </div>

          {row.deepSummary ? (
            <div className="mb-3 p-3 bg-paper border-2 border-ink">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange-d font-extrabold mb-1.5">
                {'// DeepSeek summary'}
              </div>
              <p className="text-[13px] text-ink leading-relaxed">{row.deepSummary}</p>
            </div>
          ) : null}

          {row.topInsight ? (
            <div className="mb-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Top issue
              </div>
              <div className="p-2.5 bg-paper border border-line">
                <div className="font-extrabold text-[13px]">{row.topInsight.title}</div>
                <div className="text-[12px] text-ink-70 mt-0.5">{row.topInsight.body}</div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/w/${row.workspaceSlug}/projects/${row.id}`}
              className="px-3 py-1.5 bg-ink text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange"
            >
              Open project →
            </Link>
            <Link
              href={`/w/${row.workspaceSlug}/projects/${row.id}?tab=ai`}
              className="px-3 py-1.5 border-2 border-ink text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream"
            >
              Full AI board →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, color = 'ink' }: { label: string; value: string; color?: 'success' | 'warning' | 'danger' | 'ink' }) {
  const colorClass = {
    success: 'text-success',
    warning: 'text-warn',
    danger: 'text-error',
    ink: 'text-ink',
  }[color];
  return (
    <div className="bg-paper border border-line p-2.5">
      <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">{label}</div>
      <div className={`font-black text-lg ${colorClass}`}>{value}</div>
    </div>
  );
}
