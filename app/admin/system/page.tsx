import { getSystemChecks } from '@/lib/admin/system';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminSystemPage() {
  const [checks, recentUsers, recentWebhooks] = await Promise.all([
    getSystemChecks(),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, email: true, createdAt: true, memberships: { select: { role: true } } },
    }),
    prisma.activityLog.findMany({
      where: { actorId: null }, // system-generated events
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const warnCount = checks.filter((c) => c.status === 'warning').length;
  const errCount = checks.filter((c) => c.status === 'error').length;

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">System health</h1>
      <p className="text-ink-70 text-sm mb-6">
        Live status of every integration. Use this to diagnose why emails,
        uploads, or auth aren&apos;t working.
      </p>

      {/* Summary banner */}
      <div className={`border-2 p-4 mb-6 flex items-center justify-between ${
        errCount > 0 ? 'border-error bg-error/5' :
        warnCount > 0 ? 'border-warning bg-warning/5' :
        'border-success bg-success/5'
      }`}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">Overall</div>
          <div className="font-extrabold text-lg mt-0.5">
            {errCount > 0 ? '⚠ Issues detected' : warnCount > 0 ? '⚡ Working with warnings' : '✓ All systems operational'}
          </div>
        </div>
        <div className="flex gap-3 text-[11px] font-mono uppercase tracking-[0.1em]">
          <span className="text-success">✓ {okCount}</span>
          {warnCount > 0 ? <span className="text-warning">⚠ {warnCount}</span> : null}
          {errCount > 0 ? <span className="text-error">✕ {errCount}</span> : null}
        </div>
      </div>

      {/* Check list */}
      <div className="bg-paper border-2 border-line">
        <ul className="divide-y divide-line-soft">
          {checks.map((check) => {
            const colors = {
              ok: 'bg-success/10 text-success',
              warning: 'bg-warning/10 text-warning',
              error: 'bg-error/10 text-error',
              unknown: 'bg-cream-2 text-ink-50',
            };
            const icons = { ok: '✓', warning: '⚠', error: '✕', unknown: '?' };
            return (
              <li key={check.id} className="px-5 py-3 flex items-start gap-3">
                <span className={`w-6 h-6 flex items-center justify-center font-extrabold flex-shrink-0 ${colors[check.status]}`}>
                  {icons[check.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[13px]">{check.label}</div>
                  <div className="text-[11px] text-ink-70 font-mono mt-0.5 break-words">{check.detail}</div>
                  {check.hint ? (
                    <div className="text-[11px] text-warning mt-1 font-mono break-words">
                      💡 {check.hint}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Recent users */}
      <div className="mt-8 bg-paper border-2 border-line">
        <div className="px-5 py-3 border-b border-line-soft">
          <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em]">Recent users</h2>
        </div>
        <ul className="divide-y divide-line-soft">
          {recentUsers.length === 0 ? (
            <li className="px-5 py-6 text-center text-ink-50 text-[12px]">No users yet</li>
          ) : null}
          {recentUsers.map((u) => (
            <li key={u.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[12px] truncate">{u.email}</div>
                <div className="text-[10px] font-mono text-ink-50 mt-0.5">
                  {u.memberships.length} ws · {u.memberships.map((m) => m.role).join(', ') || 'no memberships'}
                </div>
              </div>
              <span className="text-[10px] font-mono text-ink-50 flex-shrink-0">
                {new Date(u.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recent system activity (webhook events) */}
      <div className="mt-6 bg-paper border-2 border-line">
        <div className="px-5 py-3 border-b border-line-soft">
          <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em]">Recent system events</h2>
        </div>
        <ul className="divide-y divide-line-soft">
          {recentWebhooks.length === 0 ? (
            <li className="px-5 py-6 text-center text-ink-50 text-[12px]">
              No system events yet. (This is where Clerk webhook deliveries appear.)
            </li>
          ) : null}
          {recentWebhooks.map((a) => (
            <li key={a.id} className="px-5 py-2.5 flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d flex-shrink-0 w-16">
                {a.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] truncate">{a.entityName || a.entityType}</div>
                <div className="text-[10px] font-mono text-ink-50">{a.entityType}</div>
              </div>
              <span className="text-[10px] font-mono text-ink-50 flex-shrink-0">
                {new Date(a.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
