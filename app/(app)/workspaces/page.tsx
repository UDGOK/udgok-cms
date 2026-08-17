import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getUserWorkspaces } from '@/lib/auth/get-user-workspaces';
import { WorkspaceTile } from '@/components/workspace/WorkspaceTile';

export default async function WorkspacesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const workspaces = await getUserWorkspaces(userId);

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-8 py-16">
        <div className="label-eyebrow mb-4">{'// Choose your workspace'}</div>
        <h1 className="text-display-lg">
          Good <span className="font-serif italic text-orange-d">morning.</span>
        </h1>
        <p className="text-base text-ink-70 max-w-xl mt-4 mb-10">
          {workspaces.length === 0
            ? 'You haven\u2019t joined any workspaces yet. Create one to get started.'
            : `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'} available. Pick one to continue.`}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            className="bg-paper border-2 border-dashed border-line min-h-[180px] flex flex-col items-center justify-center text-ink-50 hover:border-orange hover:text-orange-d transition-colors"
          >
            <span className="text-2xl">+</span>
            <span className="font-mono text-[11px] tracking-[0.15em] font-bold mt-2">
              NEW WORKSPACE
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
