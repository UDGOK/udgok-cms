import { listClients } from '@/lib/clients/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { ClientsList } from './ClientsList';

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { q?: string; status?: string; type?: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const { items, total } = await listClients(
    workspace.id,
    {
      search: searchParams.q,
      status: searchParams.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | undefined,
      type: searchParams.type as 'RESIDENTIAL' | 'COMMERCIAL' | 'PROPERTY_MANAGER' | undefined,
    },
    { take: 50 },
  );

  return (
    <div className="p-8">
      <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          3
        </span>
        Clients
      </div>
      <h1 className="text-display-lg mb-4">
        The <span className="font-serif italic text-orange-d">relationships,</span> not the rows.
      </h1>
      <p className="text-base text-ink-70 max-w-xl mb-6">
        {total === 0
          ? 'No clients yet. Add your first to start tracking relationships.'
          : `${total} client${total === 1 ? '' : 's'}. Click a row to open the detail.`}
      </p>

      <form className="flex gap-3 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search by name or email…"
          className="flex-1 max-w-md px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="px-4 py-3 bg-ink text-cream text-xs font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange hover:border-orange transition-colors"
        >
          Search
        </button>
      </form>

      <ClientsList
        workspaceSlug={params.workspace}
        clients={items.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          type: c.type,
          status: c.status,
          _count: c._count,
        }))}
      />
    </div>
  );
}
