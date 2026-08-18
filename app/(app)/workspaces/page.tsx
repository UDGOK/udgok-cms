import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { getUserWorkspaces } from '@/lib/auth/get-user-workspaces';
import { WorkspaceTile } from '@/components/workspace/WorkspaceTile';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';

export default async function WorkspacesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [workspaces, master] = await Promise.all([
    getUserWorkspaces(userId),
    isMasterAdmin(userId),
  ]);
  void workspaces; // used below

  return (
    <div className="min-h-screen bg-cream">
      {/* Marketing-style nav (logged in) */}
      <header className="bg-paper border-b-2 border-ink sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-3.5 flex items-center justify-between gap-3">
          <Link href="/" className="font-black text-xl md:text-2xl tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 md:w-8 md:h-8 bg-ink text-cream flex items-center justify-center font-black text-sm">
              U
            </span>
            UDG<span className="text-orange">OK</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            {master ? (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d"
              >
                👑 Admin
              </Link>
            ) : null}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-16">
        {master ? (
          <div className="mb-6 md:mb-8 bg-ink text-cream border-2 border-orange p-4 md:p-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <div className="font-extrabold text-[14px]">You are a master admin</div>
                <div className="text-[11px] text-cream/70 mt-0.5">
                  Platform owner. Manage all workspaces, plans, and users.
                </div>
              </div>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d"
            >
              Open admin →
            </Link>
          </div>
        ) : null}

        <div className="mb-2 text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d font-bold">
          {'// Choose your workspace'}
        </div>
        <h1 className="font-black tracking-[-0.02em] text-4xl md:text-6xl leading-[1.05]">
          Good <span className="font-serif italic text-orange-d">morning.</span>
        </h1>
        <p className="text-base text-ink-70 max-w-xl mt-4 mb-8 md:mb-10">
          {workspaces.length === 0
            ? "You haven't joined any workspaces yet. Create one to get started."
            : `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'} available. Pick one to continue.`}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <WorkspaceTile
              key={ws.id}
              slug={ws.slug}
              name={ws.name}
              role={ws.role}
            />
          ))}
          <Link
            href="/onboarding"
            className="bg-paper border-2 border-dashed border-line min-h-[180px] flex flex-col items-center justify-center text-ink-50 hover:border-orange hover:text-orange-d transition-colors p-4"
          >
            <span className="text-3xl font-black">+</span>
            <span className="font-mono text-[11px] tracking-[0.15em] font-extrabold mt-2">
              NEW WORKSPACE
            </span>
            <span className="text-[11px] text-ink-30 mt-1">Start fresh in 2 min</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
