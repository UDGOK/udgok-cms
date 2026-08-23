import { prisma } from '@/lib/db/client';
import Link from 'next/link';
import { listMasterAdminEmails } from '@/lib/admin/permissions';
import { Prisma } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';
import { UserAdminActions } from './UserAdminActions';
import { fmtDate } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const where: Prisma.UserWhereInput = {};
  if (searchParams.q) {
    where.OR = [
      { email: { contains: searchParams.q, mode: 'insensitive' } },
      { name: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }

  const [users, total, { userId: meId }] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          include: {
            workspace: { select: { id: true, name: true, slug: true, plan: true } },
          },
        },
      },
    }),
    prisma.user.count(),
    auth(),
  ]);

  const masters = listMasterAdminEmails().map((e) => e.toLowerCase());

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">Users</h1>
          <p className="text-ink-70 text-sm">
            {users.length} of {total} total
          </p>
        </div>
      </div>

      <form className="bg-paper border-2 border-line p-4 mb-4 flex items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search by name or email…"
          className="flex-1 px-3 py-2 bg-cream border border-line text-[13px]"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.1em]"
        >
          Search
        </button>
      </form>

      <div className="bg-paper border-2 border-line">
        <table className="w-full text-[12px]">
          <thead className="bg-cream border-b border-line-soft">
            <tr className="text-left text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 hidden md:table-cell">Email</th>
              <th className="px-4 py-3">Workspaces</th>
              <th className="px-4 py-3 hidden lg:table-cell">Joined</th>
              <th className="px-4 py-3 hidden lg:table-cell">Last seen</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {users.map((u) => {
              const isMaster = masters.includes(u.email.toLowerCase());
              return (
                <tr key={u.id} className="hover:bg-cream-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-ink text-cream flex items-center justify-center text-[11px] font-black">
                          {(u.name || u.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-extrabold text-[13px] flex items-center gap-2">
                          {u.name || '—'}
                          {isMaster ? (
                            <span className="text-[8px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 bg-orange text-paper">
                              👑 Master
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <code className="text-[11px] font-mono text-ink-70">{u.email}</code>
                  </td>
                  <td className="px-4 py-3">
                    {u.memberships.length === 0 ? (
                      <span className="text-ink-30 text-[11px]">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.memberships.slice(0, 3).map((m) => (
                          <Link
                            key={m.id}
                            href={`/admin/workspaces/${m.workspaceId}`}
                            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.05em] px-2 py-0.5 bg-cream-2 hover:bg-ink hover:text-cream"
                            title={m.workspace.name}
                          >
                            <span>{m.workspace.name}</span>
                            <span className="text-ink-30">·</span>
                            <span className="font-extrabold">{m.role[0]}</span>
                          </Link>
                        ))}
                        {u.memberships.length > 3 ? (
                          <span className="text-[10px] font-mono text-ink-50">
                            +{u.memberships.length - 3}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[10px] font-mono text-ink-50">
                    {fmtDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[10px] font-mono text-ink-50">
                    {(() => {
                      const lastSeen = u.memberships
                        .map((m) => m.lastSeenAt)
                        .filter((d): d is Date => d !== null)
                        .reduce<Date>((acc, d) => (d > acc ? d : acc), u.createdAt);
                      return lastSeen.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <UserAdminActions
                      userId={u.id}
                      userName={u.name ?? ''}
                      userEmail={u.email}
                      isMaster={masters.includes(u.email.toLowerCase())}
                      isSelf={u.id === meId}
                      workspaceCount={u.memberships.length}
                    />
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-50">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
