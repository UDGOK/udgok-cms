import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getClient } from '@/lib/clients/queries';
import { listEntityActivity } from '@/lib/activity/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { StatusBadge } from '@/components/ui';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { ClientAddNoteForm } from './ClientAddNoteForm';
import { ClientTaskRow } from './ClientTaskRow';
import { ClientFileUpload } from './ClientFileUpload';

function initials(name: string) {
  return name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const STAGE_COLOR: Record<string, string> = {
  LEAD: 'bg-ink-30 text-ink',
  QUALIFIED: 'bg-cream-2 text-ink border border-line',
  PROPOSAL: 'bg-warning text-ink',
  NEGOTIATING: 'bg-orange text-paper',
  WON: 'bg-success text-paper',
  LOST: 'bg-error text-paper',
};

const PROJECT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-success text-paper',
  ON_HOLD: 'bg-warning text-ink',
  COMPLETED: 'bg-ink text-paper',
  CANCELLED: 'bg-ink-30 text-ink',
};

type Tab = 'overview' | 'deals' | 'projects' | 'tasks' | 'files' | 'notes';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'deals', label: 'Deals' },
  { key: 'projects', label: 'Projects' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'files', label: 'Files' },
  { key: 'notes', label: 'Notes' },
];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { workspace: string; id: string };
  searchParams: { tab?: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const { userId } = await auth();
  if (!userId) throw new Error('Not signed in');
  const client = await getClient(workspace.id, params.id);
  if (!client) notFound();

  const activity = await listEntityActivity(workspace.id, 'client', client.id);

  // Resolve the active tab from ?tab=...
  const rawTab = (searchParams.tab ?? 'overview').toLowerCase();
  const activeTab: Tab = (['overview', 'deals', 'projects', 'tasks', 'files', 'notes'].includes(rawTab)
    ? rawTab
    : 'overview') as Tab;

  // 4-cell stats
  const totalBilled = client.deals
    .filter((d) => d.stage === 'WON')
    .reduce((acc, d) => acc + Number(d.value), 0);
  const openDeals = client.deals.filter((d) => d.stage !== 'WON' && d.stage !== 'LOST');
  const activeProject = client.projects.find((p) => p.status === 'ACTIVE');

  // Counts for the tab badges
  const counts = {
    overview: undefined,
    deals: client.deals.length,
    projects: client.projects.length,
    tasks: client.tasks.length,
    files: client.files.length,
    notes: client.notes.length,
  };

  const base = `/w/${params.workspace}/clients/${client.id}`;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap pb-5 md:pb-7 border-b border-line bg-paper p-4 md:p-7 -mx-4 md:-m-7 mb-5 md:mb-7">
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
          <Link
            href={`/w/${workspace.slug}/clients/${client.id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-cream border-2 border-ink text-[12px] font-extrabold uppercase tracking-[0.1em] hover:bg-ink-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
          <Link
            href={`/w/${workspace.slug}/estimates/new?clientId=${client.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange text-paper border-2 border-orange text-[12px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d"
          >
            + NEW ESTIMATE
          </Link>
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
          <div className="text-[11px] text-ink-50 mt-1">{client.tasks.length} open tasks</div>
        </div>
        <div className="p-5">
          <div className="label-mono mb-1">Status</div>
          <div className="mb-1"><StatusBadge status={client.status.toLowerCase() as 'active' | 'inactive' | 'archived'} /></div>
          <div className="text-[11px] text-ink-50 mt-1">{client.type === 'RESIDENTIAL' ? 'Residential' : client.type === 'COMMERCIAL' ? 'Commercial' : 'Property manager'}</div>
        </div>
      </div>

      {/* Tabs — real <Link> components so they actually navigate */}
      <div className="flex bg-paper border-b border-line px-4 md:px-8 overflow-x-auto">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          const href = t.key === 'overview' ? base : `${base}?tab=${t.key}`;
          const count = counts[t.key];
          return (
            <Link
              key={t.key}
              href={href}
              className={`font-extrabold text-xs uppercase tracking-[0.1em] py-4 px-5 whitespace-nowrap border-b-[3px] -mb-[2px] ${
                isActive
                  ? 'text-ink border-orange'
                  : 'text-ink-50 border-transparent hover:text-ink'
              }`}
            >
              {t.label}
              {count !== undefined ? (
                <span className={`ml-2 font-mono text-[10px] px-1.5 py-0.5 ${
                  isActive ? 'bg-orange text-paper' : 'bg-cream-2 text-ink-50'
                }`}>
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Tab body */}
      <div className="mt-6">
        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Timeline */}
            <div className="md:col-span-2 bg-paper border border-line p-6 relative pl-9">
              <div className="absolute left-[33px] top-10 bottom-10 w-0.5 bg-line" />
              <div className="label-eyebrow mb-4">{'// History'}</div>
              {client.notes.length === 0 ? (
                <p className="text-ink-50 text-sm">No notes yet. Switch to the Notes tab to add one.</p>
              ) : (
                client.notes.map((n) => (
                  <div key={n.id} className="relative pb-5 grid grid-cols-[auto_1fr] gap-4">
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
        ) : null}

        {/* DEALS */}
        {activeTab === 'deals' ? (
          <div className="bg-paper border-2 border-line">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <div>
                <div className="font-extrabold text-base">Deals</div>
                <div className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-0.5">
                  {client.deals.length} total · {openDeals.length} open · {client.deals.filter((d) => d.stage === 'WON').length} won
                </div>
              </div>
            </div>
            {client.deals.length === 0 ? (
              <div className="p-12 text-center text-ink-50">
                No deals yet for {client.name}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-cream-2 border-b border-line">
                      {['Title', 'Stage', 'Value', 'Expected close', 'Created'].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {client.deals.map((d) => (
                      <tr key={d.id} className="border-b border-line-soft last:border-0 hover:bg-cream-2">
                        <td className="px-5 py-3">
                          <div className="font-extrabold text-[13px]">{d.title}</div>
                          {d.description ? (
                            <div className="text-[11px] text-ink-70 mt-0.5 line-clamp-1">{d.description}</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${STAGE_COLOR[d.stage] ?? 'bg-ink-30 text-ink'}`}>
                            {d.stage}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-black">${Number(d.value).toLocaleString()}</td>
                        <td className="px-5 py-3 text-[12px]">
                          {d.expectedClose ? new Date(d.expectedClose).toLocaleDateString() : <span className="text-ink-30">—</span>}
                        </td>
                        <td className="px-5 py-3 text-[12px] text-ink-50">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {/* PROJECTS */}
        {activeTab === 'projects' ? (
          <div className="bg-paper border-2 border-line">
            <div className="px-5 py-3 border-b border-line">
              <div className="font-extrabold text-base">Projects</div>
              <div className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-0.5">
                {client.projects.length} project{client.projects.length === 1 ? '' : 's'} for {client.name}
              </div>
            </div>
            {client.projects.length === 0 ? (
              <div className="p-12 text-center text-ink-50">
                No projects linked to {client.name} yet.
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {client.projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/w/${params.workspace}/projects/${p.id}`}
                    className="block px-5 py-4 hover:bg-cream-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-[14px] flex items-center gap-2">
                          {p.name}
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${PROJECT_STATUS_COLOR[p.status] ?? 'bg-ink-30 text-ink'}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-ink-50 tracking-[0.12em] uppercase mt-0.5">
                          {p.code ?? '—'} · {p.city ?? '—'}, {p.state ?? '—'}
                        </div>
                      </div>
                      {p.contractValue ? (
                        <div className="text-right">
                          <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">CONTRACT</div>
                          <div className="font-black text-base">${Number(p.contractValue).toLocaleString()}</div>
                        </div>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* TASKS */}
        {activeTab === 'tasks' ? (
          <div className="bg-paper border-2 border-line">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <div>
                <div className="font-extrabold text-base">Open tasks</div>
                <div className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-0.5">
                  {client.tasks.length} open · click to mark done
                </div>
              </div>
            </div>
            {client.tasks.length === 0 ? (
              <div className="p-12 text-center text-ink-50">
                No open tasks for {client.name}.
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {client.tasks.map((t) => (
                  <ClientTaskRow
                    key={t.id}
                    clientId={client.id}
                    task={{
                      id: t.id,
                      title: t.title,
                      status: t.status,
                      priority: t.priority,
                      dueDate: t.dueDate,
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* FILES */}
        {activeTab === 'files' ? (
          <div className="bg-paper border-2 border-line">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <div>
                <div className="font-extrabold text-base">Files</div>
                <div className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-0.5">
                  {client.files.length} file{client.files.length === 1 ? '' : 's'} · contracts, proposals, photos
                </div>
              </div>
            </div>
            <ClientFileUpload
              clientId={client.id}
              workspaceId={workspace.id}
              uploaderId={userId!}
            />
            {client.files.length === 0 ? (
              <div className="p-12 text-center text-ink-50">
                No files yet. Upload a contract, proposal, or photo above.
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {client.files.map((f) => (
                  <li key={f.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-cream-2 flex items-center justify-center text-[14px] flex-shrink-0">
                      {f.kind === 'PHOTO' ? '📷' : f.kind === 'CONTRACT' ? '📋' : f.kind === 'FLOORPLAN' ? '🏠' : f.kind === 'INVOICE' ? '🧾' : '📁'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-extrabold text-[13px] hover:text-orange-d truncate block"
                      >
                        {f.filename}
                      </a>
                      <div className="font-mono text-[10px] text-ink-50 tracking-[0.1em] uppercase mt-0.5">
                        {(f.size / 1024).toFixed(1)} KB · {f.kind} · {new Date(f.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* NOTES */}
        {activeTab === 'notes' ? (
          <div className="bg-paper border-2 border-line">
            <div className="px-5 py-3 border-b border-line">
              <div className="font-extrabold text-base">Notes</div>
              <div className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-0.5">
                {client.notes.length} note{client.notes.length === 1 ? '' : 's'}
              </div>
            </div>
            <ClientAddNoteForm
              clientId={client.id}
            />
            {client.notes.length === 0 ? (
              <div className="p-12 text-center text-ink-50">
                No notes yet. Use the form above to add the first one.
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {client.notes.map((n) => (
                  <li key={n.id} className="px-5 py-4">
                    <div className="text-[14px] text-ink leading-relaxed">{n.body}</div>
                    <div className="font-mono text-[10px] text-ink-50 tracking-[0.1em] uppercase mt-2">
                      {n.author?.name ?? 'Unknown'} · {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-7">
        <Link
          href={`/w/${params.workspace}/clients`}
          className="text-xs text-ink-50 hover:text-ink"
        >
          ← Back to all clients
        </Link>
      </div>

      {/* History */}
      <div className="mt-7 bg-paper border-2 border-line p-6">
        <h2 className="label-eyebrow mb-4">{'// History'}</h2>
        <ActivityFeed entries={activity} showEntityName={false} />
      </div>
    </div>
  );
}
