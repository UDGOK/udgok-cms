import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getClient } from '@/lib/clients/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { StatusBadge, Button } from '@/components/ui';

function initials(name: string) {
  return name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default async function ClientDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const client = await getClient(workspace.id, params.id);
  if (!client) notFound();

  // 4-cell stats
  const totalBilled = client.deals
    .filter((d) => d.stage === 'WON')
    .reduce((acc, d) => acc + Number(d.value), 0);
  const openDeals = client.deals.filter((d) => d.stage !== 'WON' && d.stage !== 'LOST');
  const activeProject = client.projects.find((p) => p.status === 'ACTIVE');
  const activeTasksCount = client.tasks.length;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap pb-7 border-b border-line bg-paper p-7 -m-7 mb-7">
        <div className="flex items-center gap-5">
          <div className="w-[72px] h-[72px] rounded-full bg-orange text-paper flex items-center justify-center font-black text-3xl flex-shrink-0">
            {initials(client.name)}
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight leading-tight">{client.name}</h2>
            <div className="font-mono text-[10px] text-ink-50 tracking-[0.12em] uppercase mt-1">
              {client.email ?? '—'} · {client.phone ?? '—'} · SINCE {client.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Send message</Button>
          <Button variant="primary">+ NEW ESTIMATE</Button>
        </div>
      </div>

      {/* 4-cell stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 border border-line bg-paper mb-6">
        <div className="p-5 border-r border-line md:border-b-0">
          <div className="label-mono mb-1">Total Billed</div>
          <div className="font-black text-2xl">${totalBilled.toLocaleString()}</div>
          <div className="text-[11px] text-ink-50 mt-1">{client.deals.filter((d) => d.stage === 'WON').length} won deals</div>
        </div>
        <div className="p-5 border-r border-line md:border-b-0">
          <div className="label-mono mb-1">Active</div>
          <div className="font-black text-lg">{activeProject ? activeProject.name : '—'}</div>
          <div className="text-[11px] text-success mt-1">↑ {activeProject ? `Day ${Math.floor((Date.now() - new Date(activeProject.createdAt).getTime()) / 86400000)}` : '—'}</div>
        </div>
        <div className="p-5 border-r border-line md:border-b-0">
          <div className="label-mono mb-1">Open Deals</div>
          <div className="font-black text-2xl">{openDeals.length}</div>
          <div className="text-[11px] text-ink-50 mt-1">{activeTasksCount} active tasks</div>
        </div>
        <div className="p-5">
          <div className="label-mono mb-1">Status</div>
          <div className="mb-1"><StatusBadge status={client.status.toLowerCase() as 'active' | 'inactive' | 'archived'} /></div>
          <div className="text-[11px] text-ink-50 mt-1">{client.type === 'RESIDENTIAL' ? 'Residential' : client.type === 'COMMERCIAL' ? 'Commercial' : 'Property manager'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-paper border-b border-line px-8">
        {['OVERVIEW', 'DEALS', 'PROJECTS', 'TASKS', 'FILES', 'NOTES'].map((tab, i) => (
          <div
            key={tab}
            className={`font-extrabold text-xs uppercase tracking-[0.1em] py-4 px-5 cursor-pointer ${
              i === 0 ? 'text-ink border-b-[3px] border-orange' : 'text-ink-50'
            }`}
          >
            {tab}
            {tab === 'DEALS' ? ` (${client.deals.length})` : ''}
            {tab === 'PROJECTS' ? ` (${client.projects.length})` : ''}
            {tab === 'TASKS' ? ` (${client.tasks.length})` : ''}
            {tab === 'NOTES' ? ` (${client.notes.length})` : ''}
          </div>
        ))}
      </div>

      {/* Body: timeline + properties side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-7">
        {/* Timeline */}
        <div className="md:col-span-2 bg-paper border border-line p-6 relative pl-9">
          <div className="absolute left-[33px] top-10 bottom-10 w-0.5 bg-line" />
          <div className="label-eyebrow mb-4">{'// History'}</div>
          {client.notes.length === 0 ? (
            <p className="text-ink-50 text-sm">No notes yet. Add one to start the timeline.</p>
          ) : (
            client.notes.map((n, idx) => (
              <div key={n.id} className={`relative pb-5 grid grid-cols-[auto_1fr] gap-4 ${idx === 0 ? '' : ''}`}>
                <div className="w-3.5 h-3.5 rounded-full bg-paper border-2 border-ink mt-1" />
                <div>
                  <div className="font-mono text-[10px] text-ink-50 tracking-[0.12em] uppercase">
                    {n.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-[13px] font-bold text-ink mt-0.5">{n.body}</div>
                  <div className="text-[11px] text-ink-50 mt-1">
                    by <b className="text-ink font-bold">{n.author?.name ?? 'Unknown'}</b>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Properties */}
        <div>
          <div className="bg-paper border border-line">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="font-extrabold uppercase tracking-tight text-base">Properties</h3>
            </div>
            <div className="p-5 space-y-4">
              {client.properties.length === 0 ? (
                <p className="text-ink-50 text-sm">No properties yet.</p>
              ) : (
                client.properties.map((p) => (
                  <div key={p.id} className="pb-4 border-b border-line-soft last:border-0 last:pb-0">
                    <div className="font-extrabold text-[13px]">{p.label}</div>
                    <div className="font-mono text-[9px] text-ink-50 tracking-[0.1em] my-1">
                      {p.city.toUpperCase()} · {p.state.toUpperCase()} · {p.sqft ? `${p.sqft.toLocaleString()} SQFT` : '—'}
                    </div>
                    <div className="text-[11px] text-ink-70">{p.address}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7">
        <Link
          href={`/w/${params.workspace}/clients`}
          className="text-xs text-ink-50 hover:text-ink"
        >
          ← Back to all clients
        </Link>
      </div>
    </div>
  );
}
